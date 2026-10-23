import { Request, Response } from "express";
import { Prisma, TicketRequestStatus, TicketRequestType } from "@prisma/client";
import { prisma } from "../app";
import { addOrReduceStock } from "./stock.controller";
import { getSaleTotal, removeSale } from "./stats.controller";
import { notifyTicketRequest } from "../services/notify";

/** One line change of an EDIT request (to = 0 removes the line) */
export interface TicketChange {
  type: "product" | "service";
  id: number;
  name: string;
  price: number;
  from: number;
  to: number;
}

/** Error whose message is shown to the admin (409) */
class RequestError extends Error {}

const lineSelect = {
  id: true,
  price: true,
  quantity: true,
  pack_name: true,
} satisfies Prisma.SalesProductsSelect;

const requestInclude = {
  user: { select: { id: true, name: true } },
  reviewer: { select: { id: true, name: true } },
  sale: {
    select: {
      date: true,
      total: true,
      payment_method: true,
      local: { select: { name: true } },
      products: { select: { ...lineSelect, product: { select: { name: true } } } },
      services: { select: { ...lineSelect, service: { select: { name: true } } } },
    },
  },
} satisfies Prisma.TicketRequestInclude;

type RequestWithRelations = Prisma.TicketRequestGetPayload<{
  include: typeof requestInclude;
}>;

/** Request + the current content of its ticket (null once deleted) */
const formatRequest = (r: RequestWithRelations) => ({
  id: r.id,
  type: r.type,
  status: r.status,
  reason: r.reason,
  created_at: r.created_at,
  reviewed_at: r.reviewed_at,
  ticket_id: r.ticket_id,
  ticket_total: r.ticket_total,
  changes: (r.changes ?? []) as unknown as TicketChange[],
  user: r.user,
  reviewer: r.reviewer,
  ticket: r.sale && {
    date: r.sale.date,
    total: r.sale.total,
    payment_method: r.sale.payment_method,
    local: r.sale.local.name,
    lines: [
      ...r.sale.services.map((l) => ({
        type: "service" as const,
        id: l.id,
        name: l.service.name,
        price: l.price,
        quantity: l.quantity,
        pack_name: l.pack_name,
      })),
      ...r.sale.products.map((l) => ({
        type: "product" as const,
        id: l.id,
        name: l.product.name,
        price: l.price,
        quantity: l.quantity,
        pack_name: l.pack_name,
      })),
    ],
  },
});

/**
 * A cashier asks to delete one of their tickets, or to change its lines.
 * Body: { sale_id, type: "DELETE" | "EDIT", reason?, changes?: [{ type, id, quantity }] }
 */
export const createTicketRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  const sale_id = Number(req.body.sale_id);
  const type = req.body.type as TicketRequestType;
  const reason =
    typeof req.body.reason === "string"
      ? req.body.reason.trim().slice(0, 500) || null
      : null;

  if (!Number.isInteger(sale_id) || !["DELETE", "EDIT"].includes(type)) {
    res.status(400).json({ message: "Demande invalide" });
    return;
  }

  try {
    const sale = await prisma.sales.findUnique({
      where: { id: sale_id },
      include: {
        products: { select: { ...lineSelect, product: { select: { name: true } } } },
        services: { select: { ...lineSelect, service: { select: { name: true } } } },
      },
    });
    if (!sale) {
      res.status(404).json({ message: "Ticket introuvable" });
      return;
    }
    if (sale.user_id !== sessionUser.id) {
      res.status(403).json({ message: "Ce ticket n'est pas le vôtre" });
      return;
    }

    const pending = await prisma.ticketRequest.findFirst({
      where: { sale_id, status: "PENDING" },
    });
    if (pending) {
      res
        .status(409)
        .json({ message: "Une demande est déjà en attente pour ce ticket" });
      return;
    }

    let finalType = type;
    let changes: TicketChange[] | null = null;

    if (type === "EDIT") {
      const lines = [
        ...sale.services.map((l) => ({
          type: "service" as const,
          id: l.id,
          name: l.service.name,
          price: l.price,
          from: l.quantity,
        })),
        ...sale.products.map((l) => ({
          type: "product" as const,
          id: l.id,
          name: l.product.name,
          price: l.price,
          from: l.quantity,
        })),
      ];

      changes = [];
      const requested = Array.isArray(req.body.changes) ? req.body.changes : [];
      for (const change of requested) {
        const line = lines.find(
          (l) => l.type === change?.type && l.id === Number(change?.id)
        );
        const to = Number(change?.quantity);
        if (!line || !Number.isInteger(to) || to < 0 || to > 999) {
          res.status(400).json({ message: "Modification invalide" });
          return;
        }
        if (to !== line.from) changes.push({ ...line, to });
      }

      if (changes.length === 0) {
        res.status(400).json({ message: "Aucune modification demandée" });
        return;
      }

      // every line removed: it is a deletion
      const remaining = lines.filter(
        (l) =>
          (changes!.find((c) => c.type === l.type && c.id === l.id)?.to ??
            l.from) > 0
      );
      if (remaining.length === 0) {
        finalType = "DELETE";
        changes = null;
      }
    }

    const request = await prisma.ticketRequest.create({
      data: {
        sale_id,
        ticket_id: sale.id,
        ticket_total: sale.total,
        type: finalType,
        changes: changes
          ? (changes as unknown as Prisma.InputJsonArray)
          : Prisma.DbNull,
        reason,
        user_id: sessionUser.id,
      },
      include: requestInclude,
    });

    notifyTicketRequest(request.id);
    res.status(201).json({ data: formatRequest(request) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Échec de l'envoi de la demande", error });
  }
};

/**
 * Requests list, newest first. Filter: status (PENDING / APPROVED / REJECTED).
 * Cashiers only see their own requests.
 */
export const listTicketRequests = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    res.status(401).json({ message: "Session expirée" });
    return;
  }

  const where: Prisma.TicketRequestWhereInput = {};
  const status = req.query.status as TicketRequestStatus | undefined;
  if (status && ["PENDING", "APPROVED", "REJECTED"].includes(status)) {
    where.status = status;
  }
  if (sessionUser.role !== "ADMIN") where.user_id = sessionUser.id;

  try {
    const requests = await prisma.ticketRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { created_at: status === "PENDING" ? "asc" : "desc" },
      take: 200,
    });
    res.json({ data: requests.map(formatRequest) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to list ticket requests", error });
  }
};

/** Applies an approved request to its ticket (stock included) */
const applyRequest = async (
  request: { type: TicketRequestType; sale_id: number | null; changes: Prisma.JsonValue },
  deletedBy: string
) => {
  const sale = request.sale_id
    ? await prisma.sales.findUnique({ where: { id: request.sale_id } })
    : null;

  if (request.type === "DELETE") {
    // already deleted (e.g. directly from the tickets page): nothing left to do
    if (sale) await removeSale(sale.id, deletedBy);
    return;
  }

  if (!sale) throw new RequestError("Ce ticket a été supprimé entre-temps");

  const changes = (request.changes ?? []) as unknown as TicketChange[];
  for (const change of changes) {
    if (change.type === "product") {
      const line = await prisma.salesProducts.findUnique({
        where: { id: change.id },
      });
      // line already removed from the ticket
      if (!line || line.sale_id !== sale.id) continue;

      if (change.to === 0) {
        await prisma.salesProducts.delete({ where: { id: line.id } });
      } else {
        await prisma.salesProducts.update({
          where: { id: line.id },
          data: { quantity: change.to },
        });
      }

      const diff = change.to - line.quantity;
      if (diff !== 0) {
        await addOrReduceStock(
          line.product_id,
          Math.abs(diff),
          sale.local_id,
          diff > 0 ? "down" : "up"
        );
      }
    } else {
      const line = await prisma.salesServices.findUnique({
        where: { id: change.id },
      });
      if (!line || line.sale_id !== sale.id) continue;

      if (change.to === 0) {
        await prisma.salesServices.delete({ where: { id: line.id } });
      } else {
        await prisma.salesServices.update({
          where: { id: line.id },
          data: { quantity: change.to },
        });
      }
    }
  }

  const [products, services] = await Promise.all([
    prisma.salesProducts.count({ where: { sale_id: sale.id } }),
    prisma.salesServices.count({ where: { sale_id: sale.id } }),
  ]);
  if (products + services === 0) {
    await removeSale(sale.id, deletedBy);
  } else {
    await getSaleTotal(sale.id);
  }
};

/** Admin validates ({ approve: true }) or refuses ({ approve: false }) a request */
export const reviewTicketRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionUser = req.session.user!;
  const id = Number(req.params.id);
  const approve = req.body.approve === true;

  if (!Number.isInteger(id)) {
    res.status(400).json({ message: "Demande invalide" });
    return;
  }

  try {
    const request = await prisma.ticketRequest.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    });
    if (!request) {
      res.status(404).json({ message: "Demande introuvable" });
      return;
    }

    // status: PENDING guards against two admins handling it at once
    const { count } = await prisma.ticketRequest.updateMany({
      where: { id, status: "PENDING" },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        reviewer_id: sessionUser.id,
        reviewed_at: new Date(),
      },
    });
    if (count === 0) {
      res.status(409).json({ message: "Cette demande a déjà été traitée" });
      return;
    }

    if (approve) {
      try {
        await applyRequest(
          request,
          `${sessionUser.name} (demande de ${request.user.name})`
        );
      } catch (error) {
        await prisma.ticketRequest.update({
          where: { id },
          data: { status: "PENDING", reviewer_id: null, reviewed_at: null },
        });
        if (error instanceof RequestError) {
          res.status(409).json({ message: error.message });
          return;
        }
        throw error;
      }
    }

    const updated = await prisma.ticketRequest.findUniqueOrThrow({
      where: { id },
      include: requestInclude,
    });
    res.json({ data: formatRequest(updated) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Échec du traitement de la demande", error });
  }
};
