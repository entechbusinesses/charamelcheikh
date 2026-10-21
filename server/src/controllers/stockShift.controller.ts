import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../app";
import { round2 } from "./stats.controller";

const stockShiftInclude = {
  user: { select: { id: true, name: true } },
  local: { select: { id: true, name: true, type: true } },
} satisfies Prisma.StockShiftInclude;

type StockShiftWithRelations = Prisma.StockShiftGetPayload<{
  include: typeof stockShiftInclude;
}>;

/**
 * Stock movements of a local between two dates (from inclusive, to exclusive):
 * value of the bons de réception received / sent, and of the products sold.
 */
export const stockMovements = async (local_id: number, from: Date, to: Date) => {
  const date = { gte: from, lt: to };

  const [received, sent, sold] = await Promise.all([
    prisma.receptionProducts.findMany({
      where: { reception: { to_id: local_id, date } },
      select: { price: true, quantity: true },
    }),
    prisma.receptionProducts.findMany({
      where: { reception: { from_id: local_id, isBough: false, date } },
      select: { price: true, quantity: true },
    }),
    prisma.salesProducts.findMany({
      where: { sale: { local_id, date } },
      select: { price: true, quantity: true },
    }),
  ]);

  const value = (rows: { price: number; quantity: number }[]) =>
    round2(rows.reduce((s, r) => s + r.price * r.quantity, 0));

  const receptionsCount = await prisma.receptionList.count({
    where: { to_id: local_id, date },
  });

  return {
    receptions_in: value(received),
    receptions_out: value(sent),
    sales_products: value(sold),
    receptions_count: receptionsCount,
  };
};

/**
 * expected_sales = initial + bons reçus - bons sortis - stock final
 * difference = ventes produits - expected_sales
 *   0  → OK, < 0 → manque (stock sorti non vendu), > 0 → excédent
 */
export const stockResult = (values: {
  initial_value: number;
  final_value: number;
  receptions_in: number;
  receptions_out: number;
  sales_products: number;
}) => {
  const expected_sales = round2(
    values.initial_value +
      values.receptions_in -
      values.receptions_out -
      values.final_value
  );
  const difference = round2(values.sales_products - expected_sales);
  return {
    expected_sales,
    difference,
    status: difference === 0 ? "OK" : difference < 0 ? "MANQUE" : "EXCEDENT",
  };
};

/** Open shifts get their live movements (up to now); closed ones their saved values */
const withResult = async (shift: StockShiftWithRelations) => {
  if (shift.ended_at) {
    return { ...shift, live: false, ...stockResult(shift) };
  }
  const movements = await stockMovements(
    shift.local_id,
    shift.started_at,
    new Date()
  );
  return {
    ...shift,
    ...movements,
    live: true,
    ...stockResult({ ...shift, ...movements }),
  };
};

const parseDate = (value: unknown) => {
  if (!value) return new Date();
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseValue = (value: unknown) => {
  const n = Number(value);
  return value !== "" && value != null && Number.isFinite(n) && n >= 0
    ? round2(n)
    : null;
};

const requireAdmin = (req: Request, res: Response) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return null;
  }
  if (sessionUser.role !== "ADMIN") {
    res.status(403).json({ message: "Réservé aux administrateurs" });
    return null;
  }
  return sessionUser;
};

/** Stock shifts, newest first. Filters: local_id, status (OPEN / CLOSED) */
export const listStockShifts = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const { local_id, status } = req.query as Record<string, string | undefined>;
  const where: Prisma.StockShiftWhereInput = {};
  if (local_id && local_id !== "tous") where.local_id = +local_id;
  if (status === "OPEN") where.ended_at = null;
  if (status === "CLOSED") where.ended_at = { not: null };

  try {
    const shifts = await prisma.stockShift.findMany({
      where,
      include: stockShiftInclude,
      orderBy: { started_at: "desc" },
    });
    res.json({ data: await Promise.all(shifts.map(withResult)) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to list stock shifts", error });
  }
};

export const startStockShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = requireAdmin(req, res);
  if (!sessionUser) return;

  const local_id = Number(req.body.local_id);
  const initial_value = parseValue(req.body.initial_value);
  const started_at = parseDate(req.body.started_at);

  if (initial_value === null) {
    res.status(400).json({ message: "Valeur du stock initial invalide" });
    return;
  }
  if (!started_at) {
    res.status(400).json({ message: "Date de début invalide" });
    return;
  }

  try {
    const local = await prisma.locals.findUnique({ where: { id: local_id } });
    if (!local || local.type !== "BELDI") {
      res.status(400).json({ message: "Veuillez choisir un local BELDI" });
      return;
    }

    const shift = await prisma.stockShift.create({
      data: {
        local_id,
        active_local_id: local_id,
        user_id: sessionUser.id,
        started_at,
        initial_value,
        note: req.body.note || null,
      },
      include: stockShiftInclude,
    });

    res.status(201).json({ data: await withResult(shift) });
  } catch (error) {
    // unique active_local_id: a stock shift is already open in this local
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        message: "Un shift de stock est déjà en cours dans ce local",
      });
      return;
    }
    console.log(error);
    res.status(500).json({ message: "Failed to start stock shift", error });
  }
};

/** Movements and result of an open shift up to `ended_at`, for a given final value */
export const previewStockShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const ended_at = parseDate(req.query.ended_at);
  const final_value = parseValue(req.query.final_value) ?? 0;

  try {
    const shift = await prisma.stockShift.findUnique({
      where: { id: +req.params.id },
    });
    if (!shift || shift.ended_at) {
      res.status(404).json({ message: "Aucun shift de stock en cours" });
      return;
    }
    if (!ended_at || ended_at < shift.started_at) {
      res.status(400).json({ message: "Date de fin invalide" });
      return;
    }

    const movements = await stockMovements(
      shift.local_id,
      shift.started_at,
      ended_at
    );
    res.json({
      data: {
        ...movements,
        ...stockResult({ ...shift, ...movements, final_value }),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to preview stock shift", error });
  }
};

/** Closes a stock shift with the counted stock value and saves the movements */
export const closeStockShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  const final_value = parseValue(req.body.final_value);
  const ended_at = parseDate(req.body.ended_at);

  if (final_value === null) {
    res.status(400).json({ message: "Valeur du stock final invalide" });
    return;
  }

  try {
    const shift = await prisma.stockShift.findUnique({
      where: { id: +req.params.id },
    });
    if (!shift || shift.ended_at) {
      res.status(404).json({ message: "Aucun shift de stock en cours" });
      return;
    }
    if (!ended_at || ended_at < shift.started_at) {
      res.status(400).json({ message: "Date de fin invalide" });
      return;
    }

    const { receptions_count, ...movements } = await stockMovements(
      shift.local_id,
      shift.started_at,
      ended_at
    );

    // ended_at: null guards against closing twice
    const { count } = await prisma.stockShift.updateMany({
      where: { id: shift.id, ended_at: null },
      data: {
        ...movements,
        ended_at,
        final_value,
        active_local_id: null,
        note: req.body.note ?? shift.note,
      },
    });
    if (count === 0) {
      res.status(404).json({ message: "Aucun shift de stock en cours" });
      return;
    }

    const closed = await prisma.stockShift.findUniqueOrThrow({
      where: { id: shift.id },
      include: stockShiftInclude,
    });
    res.json({ data: { ...(await withResult(closed)), receptions_count } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to close stock shift", error });
  }
};

export const deleteStockShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  if (!requireAdmin(req, res)) return;

  try {
    await prisma.stockShift.delete({ where: { id: +req.params.id } });
    res.json({ message: "Shift de stock supprimé" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to delete stock shift", error });
  }
};
