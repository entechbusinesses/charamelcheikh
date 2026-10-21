import { Request, Response } from "express";
import { PaymentMethod, PDVTypes, Prisma } from "@prisma/client";
import { prisma } from "../app";
import { round2, saleAmounts } from "./stats.controller";
import { notifyShiftClosed, notifyShiftStarted } from "../services/notify";

const shiftInclude = {
  user: { select: { id: true, name: true } },
  local: { select: { id: true, name: true, type: true, logo_url: true } },
} satisfies Prisma.ShiftInclude;

type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: typeof shiftInclude;
}>;

const emptySummary = () => ({
  count: 0,
  total: 0,
  cash: 0,
  tpe: 0,
  products: 0,
  services: 0,
  frais: 0,
  methods: { CASH: 0, TPE: 0, MIXTE: 0 } as Record<PaymentMethod, number>,
});

type Summary = ReturnType<typeof emptySummary>;

/** Totals of the sales made during each shift, by shift id */
export const shiftSummaries = async (shift_ids: number[]) => {
  const summaries = new Map<number, Summary>(
    shift_ids.map((id) => [id, emptySummary()])
  );
  if (shift_ids.length === 0) return summaries;

  const sales = await prisma.sales.findMany({
    where: { shift_id: { in: shift_ids } },
    include: {
      products: { select: { price: true, quantity: true } },
      services: { select: { price: true, quantity: true, frais: true } },
    },
  });

  sales.forEach((sale) => {
    const row = summaries.get(sale.shift_id!)!;
    const amounts = saleAmounts(sale);
    row.count += 1;
    row.methods[sale.payment_method] += 1;
    row.cash += amounts.cash;
    row.tpe += amounts.tpe;
    row.products += sale.products.reduce((s, p) => s + p.price * p.quantity, 0);
    row.services += sale.services.reduce((s, x) => s + x.price * x.quantity, 0);
    row.frais += sale.services.reduce((s, x) => s + x.frais * x.quantity, 0);
  });

  summaries.forEach((row) => {
    row.cash = round2(row.cash);
    row.tpe = round2(row.tpe);
    row.total = round2(row.cash + row.tpe);
    row.products = round2(row.products);
    row.services = round2(row.services);
    row.frais = round2(row.frais);
  });

  return summaries;
};

export const shiftSummary = async (shift_id: number) =>
  (await shiftSummaries([shift_id])).get(shift_id)!;

/** Shift + its live totals; balance = fond de caisse + cash received */
const withSummary = async (shift: ShiftWithRelations) => {
  const summary = await shiftSummary(shift.id);
  return {
    ...shift,
    summary,
    balance: round2(shift.fond_caisse + summary.cash),
  };
};

export const getCurrentShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { local_id: true },
    });

    const shift = await prisma.shift.findFirst({
      where: { user_id: sessionUser.id, closed_at: null },
      include: shiftInclude,
    });

    // open shift of another user in the same local (blocks starting one)
    const localShift = user?.local_id
      ? await prisma.shift.findUnique({
          where: { active_local_id: user.local_id },
          include: shiftInclude,
        })
      : null;

    res.json({
      shift: shift ? await withSummary(shift) : null,
      localShift:
        localShift && localShift.user_id !== sessionUser.id
          ? {
              id: localShift.id,
              opened_at: localShift.opened_at,
              user: localShift.user,
            }
          : null,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to fetch shift", error });
  }
};

export const startShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  const fond = Number(req.body.fond_caisse);
  if (!Number.isFinite(fond) || fond < 0) {
    res.status(400).json({ message: "Fond de caisse invalide" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { local_id: true },
    });
    const local_id = user?.local_id;

    if (!local_id) {
      res.status(400).json({ message: "Aucun local associé à ce compte" });
      return;
    }

    const own = await prisma.shift.findFirst({
      where: { user_id: sessionUser.id, closed_at: null },
    });
    if (own) {
      res.status(409).json({ message: "Vous avez déjà un shift en cours" });
      return;
    }

    try {
      const shift = await prisma.shift.create({
        data: {
          user_id: sessionUser.id,
          local_id,
          active_local_id: local_id,
          fond_caisse: round2(fond),
        },
        include: shiftInclude,
      });

      notifyShiftStarted(shift);
      res.status(201).json({ data: await withSummary(shift) });
    } catch (error) {
      // unique active_local_id: another shift is open in this local
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const other = await prisma.shift.findUnique({
          where: { active_local_id: local_id },
          include: { user: { select: { name: true } } },
        });
        res.status(409).json({
          message: `Un shift est déjà en cours dans ce local${
            other ? ` (${other.user.name})` : ""
          }`,
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to start shift", error });
  }
};

/**
 * Closes the current user's shift, or the shift `id` (admins only for
 * someone else's shift), and saves its totals.
 */
export const closeShift = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  const { id } = req.body;

  try {
    const shift = id
      ? await prisma.shift.findUnique({ where: { id: +id } })
      : await prisma.shift.findFirst({
          where: { user_id: sessionUser.id, closed_at: null },
        });

    if (!shift || shift.closed_at) {
      res.status(404).json({ message: "Aucun shift en cours" });
      return;
    }

    if (shift.user_id !== sessionUser.id && sessionUser.role !== "ADMIN") {
      res.status(403).json({ message: "Ce shift n'est pas le vôtre" });
      return;
    }

    const summary = await shiftSummary(shift.id);

    // closed_at: null guards against closing twice
    const { count } = await prisma.shift.updateMany({
      where: { id: shift.id, closed_at: null },
      data: {
        closed_at: new Date(),
        active_local_id: null,
        sales_count: summary.count,
        total_sales: summary.total,
        total_cash: summary.cash,
        total_tpe: summary.tpe,
      },
    });
    if (count === 0) {
      res.status(404).json({ message: "Aucun shift en cours" });
      return;
    }

    const closed = await prisma.shift.findUniqueOrThrow({
      where: { id: shift.id },
      include: shiftInclude,
    });

    notifyShiftClosed(closed, summary, sessionUser.name);
    res.json({
      data: {
        ...closed,
        summary,
        balance: round2(closed.fond_caisse + summary.cash),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to close shift", error });
  }
};

/**
 * Shifts list with their totals. Filters: from / to (opening day, inclusive),
 * user_id, local_id, type (local type), status (OPEN / CLOSED).
 * Cashiers only see their own shifts.
 */
export const listShifts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  const { from, to, user_id, local_id, type, status } = req.query as Record<
    string,
    string | undefined
  >;
  const where: Prisma.ShiftWhereInput = {};

  if (from) {
    where.opened_at = { gte: new Date(`${from}T00:00:00`) };
  }
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    where.opened_at = { ...(where.opened_at as object), lt: end };
  }

  if (sessionUser.role !== "ADMIN") {
    where.user_id = sessionUser.id;
  } else if (user_id && user_id !== "tous") {
    where.user_id = +user_id;
  }

  if (local_id && local_id !== "tous") {
    where.local_id = +local_id;
  }

  if (type && ["BELDI", "TURKI", "DEPOT"].includes(type)) {
    where.local = { type: type as PDVTypes };
  }

  if (status === "OPEN") where.closed_at = null;
  if (status === "CLOSED") where.closed_at = { not: null };

  try {
    const shifts = await prisma.shift.findMany({
      where,
      include: shiftInclude,
      orderBy: { opened_at: "desc" },
    });

    const summaries = await shiftSummaries(shifts.map((s) => s.id));

    res.json({
      data: shifts.map((shift) => {
        const summary = summaries.get(shift.id)!;
        return {
          ...shift,
          summary,
          balance: round2(shift.fond_caisse + summary.cash),
        };
      }),
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to list shifts", error });
  }
};
