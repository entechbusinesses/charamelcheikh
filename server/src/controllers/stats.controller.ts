import { Request, Response } from "express";
import { PaymentMethod } from "@prisma/client";
import { prisma } from "../app";
import { addOrReduceStock } from "./stock.controller";
import {
  notifySaleCreated,
  notifySaleDeleted,
  notifySaleItemAdded,
} from "../services/notify";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "TPE", "MIXTE"];
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Splits a sale total between cash and TPE for the given method.
 * For MIXTE the TPE part is kept and cash covers the rest.
 */
const splitPayment = (
  method: PaymentMethod,
  total: number,
  tpe = 0
): { paid_cash: number; paid_tpe: number } => {
  if (method === "TPE") return { paid_cash: 0, paid_tpe: round2(total) };
  if (method === "MIXTE") {
    const paid_tpe = round2(Math.min(Math.max(tpe, 0), total));
    return { paid_cash: round2(total - paid_tpe), paid_tpe };
  }
  return { paid_cash: round2(total), paid_tpe: 0 };
};

/** Cash / TPE amounts of a saved sale (single methods always follow the total) */
export const saleAmounts = (sale: {
  payment_method: PaymentMethod;
  total: number;
  paid_cash: number;
  paid_tpe: number;
}) => {
  if (sale.payment_method === "MIXTE") {
    return { cash: sale.paid_cash, tpe: sale.paid_tpe };
  }
  const { paid_cash, paid_tpe } = splitPayment(sale.payment_method, sale.total);
  return { cash: paid_cash, tpe: paid_tpe };
};

/** Shared filters of the tickets list and the report */
const buildSalesWhere = (query: Request["query"]) => {
  const { from, to, user_id, local_id, payment } = query as Record<
    string,
    string | undefined
  >;
  const where: any = {};

  if (from && to) {
    const startTime = new Date(from);
    startTime.setHours(5, 0, 0, 0);

    const endTime = new Date(to);
    endTime.setHours(5, 0, 0, 0);

    where.date = {
      gte: startTime,
      lt: endTime,
    };
  }

  if (user_id && user_id !== "tous") {
    where.user_id = +user_id;
  }

  if (local_id && local_id !== "tous") {
    where.local_id = +local_id;
  }

  if (payment && PAYMENT_METHODS.includes(payment as PaymentMethod)) {
    where.payment_method = payment;
  }

  return where;
};

// export const  = async (req: Request, res: Response): Promise<void> => {
//   const {  } = req.body;

//   try {
//     const data = await prisma.

//     res.status(201).json({ message: "Stat registered successfully", data });
//   } catch (error) {
//     res.status(500).json({ message: "Failed to add Stat", error });
//   }
// };

export const getStatItems = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { stat_id } = req.params;

  try {
    const data = await prisma.sales.findUnique({
      where: {
        id: +stat_id,
      },
      include: {
        products: {
          select: {
            id: true,
            price: true,
            quantity: true,
            pack_name: true,
            product: { select: { name: true } },
          },
        },
        services: {
          select: {
            id: true,
            frais: true,
            quantity: true,
            price: true,
            pack_name: true,
            service: { select: { name: true } },
          },
        },
      },
    });

    const prods = data?.products.map((item) => ({
      id: item.id,
      name: item.product.name,
      price: item.price,
      quantity: item.quantity,
      pack_name: item.pack_name,
      type: "product",
    }));

    const servs = data?.services.map((item) => ({
      id: item.id,
      frais: item.frais,
      name: item.service.name,
      price: item.price,
      quantity: item.quantity,
      pack_name: item.pack_name,
      type: "service",
    }));

    res.status(201).json({
      message: "Stat registered successfully",
      data: [...(prods as any), ...(servs as any)],
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
    console.log(error);
  }
};

export const StatsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const where = buildSalesWhere(req.query);

    const data = await prisma.sales.findMany({
      where,
      include: {
        user: { select: { name: true } },
        local: { select: { name: true, type: true, id: true } },
        products: {
          include: {
            product: { select: { id: true } },
          },
        },
        services: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    res.status(201).json({ message: "Stat registered successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to see Stats's list", error });
    console.log(error);
  }
};

interface ProductSaleData {
  name: string;
  quantity: number;
  total: number;
}

interface ServiceSaleData {
  name: string;
  quantity: number;
  total: number;
  frais: number;
}

interface PaymentMethodStats {
  method: PaymentMethod;
  count: number;
  cash: number;
  tpe: number;
  total: number;
}

interface LocalSalesStats {
  local_id: number;
  name: string;
  type: string;
  count: number;
  products: number;
  services: number;
  frais: number;
  cash: number;
  tpe: number;
}

interface SalesReportData {
  locals: LocalSalesStats[];
  products: ProductSaleData[];
  services: ServiceSaleData[];
  payments: {
    methods: PaymentMethodStats[];
    cash: number;
    tpe: number;
    total: number;
    count: number;
  };
}

export const SalesStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const where = buildSalesWhere(req.query);

    // Get all stats based on filters
    const stats = await prisma.sales.findMany({
      where,
      include: {
        local: { select: { id: true, name: true, type: true } },
        products: {
          include: {
            product: true,
          },
        },
        services: {
          include: {
            service: true,
          },
        },
      },
    });

    // Aggregate products
    const productMap = new Map<string, ProductSaleData>();
    stats.forEach((stat) => {
      stat.products.forEach((prod) => {
        const key = prod.product.name;
        const existing = productMap.get(key);

        if (existing) {
          productMap.set(key, {
            name: key,
            quantity: existing.quantity + prod.quantity,
            total: existing.total + prod.price * prod.quantity,
          });
        } else {
          productMap.set(key, {
            name: key,
            quantity: prod.quantity,
            total: prod.price * prod.quantity,
          });
        }
      });
    });

    // Aggregate services
    const serviceMap = new Map<string, ServiceSaleData>();
    stats.forEach((stat) => {
      stat.services.forEach((serv) => {
        const key = serv.pack_name
          ? `Pack ${serv.pack_name} — ${serv.service.name}`
          : serv.service.name;
        const existing = serviceMap.get(key);

        if (existing) {
          serviceMap.set(key, {
            name: key,
            quantity: existing.quantity + serv.quantity,
            total: existing.total + serv.price * serv.quantity,
            frais: existing.frais + serv.frais * serv.quantity,
          });
        } else {
          serviceMap.set(key, {
            name: key,
            quantity: serv.quantity,
            total: serv.price * serv.quantity,
            frais: serv.frais * serv.quantity,
          });
        }
      });
    });

    // Payment methods breakdown
    const methods = PAYMENT_METHODS.map<PaymentMethodStats>((method) => ({
      method,
      count: 0,
      cash: 0,
      tpe: 0,
      total: 0,
    }));
    stats.forEach((sale) => {
      const row = methods.find((m) => m.method === sale.payment_method)!;
      const { cash, tpe } = saleAmounts(sale);
      row.count += 1;
      row.cash = round2(row.cash + cash);
      row.tpe = round2(row.tpe + tpe);
      row.total = round2(row.total + cash + tpe);
    });

    // Per local breakdown
    const localMap = new Map<number, LocalSalesStats>();
    stats.forEach((sale) => {
      const row =
        localMap.get(sale.local_id) ??
        localMap
          .set(sale.local_id, {
            local_id: sale.local_id,
            name: sale.local.name,
            type: sale.local.type,
            count: 0,
            products: 0,
            services: 0,
            frais: 0,
            cash: 0,
            tpe: 0,
          })
          .get(sale.local_id)!;
      const { cash, tpe } = saleAmounts(sale);
      row.count += 1;
      row.products = round2(
        row.products +
          sale.products.reduce((s, p) => s + p.price * p.quantity, 0)
      );
      row.services = round2(
        row.services +
          sale.services.reduce((s, x) => s + x.price * x.quantity, 0)
      );
      row.frais = round2(
        row.frais + sale.services.reduce((s, x) => s + x.frais * x.quantity, 0)
      );
      row.cash = round2(row.cash + cash);
      row.tpe = round2(row.tpe + tpe);
    });

    const responseData: SalesReportData = {
      locals: Array.from(localMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      products: Array.from(productMap.values()),
      services: Array.from(serviceMap.values()),
      payments: {
        methods,
        cash: round2(methods.reduce((s, m) => s + m.cash, 0)),
        tpe: round2(methods.reduce((s, m) => s + m.tpe, 0)),
        total: round2(methods.reduce((s, m) => s + m.total, 0)),
        count: stats.length,
      },
    };

    res.json({
      data: responseData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate sales report" });
  }
};

export const AddToStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { user_id, services, products, packs, total, payment } = req.body;

  const method: PaymentMethod = PAYMENT_METHODS.includes(payment?.method)
    ? payment.method
    : "CASH";

  if (method === "MIXTE") {
    const cash = +payment?.cash || 0;
    const tpe = +payment?.tpe || 0;
    if (cash <= 0 || tpe <= 0 || Math.abs(cash + tpe - +total) > 0.01) {
      res.status(400).json({
        message: "Paiement mixte invalide: espèces + TPE doit égaler le total",
      });
      return;
    }
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: +user_id } });

    if (!user || !user.local_id) {
      res.status(404).json({ message: "User Or Local_ID not valable" });

      return;
    }

    // selling requires an open shift; the sale goes to the shift's local
    const shift = await prisma.shift.findFirst({
      where: { user_id: user.id, closed_at: null },
    });

    if (!shift) {
      res.status(403).json({
        message: "Aucun shift en cours : démarrez un shift pour vendre",
      });
      return;
    }

    const local_id = shift.local_id;

    let packLines: Awaited<ReturnType<typeof packsToLines>> = {
      services: [],
      products: [],
      total: 0,
    };
    if (Array.isArray(packs) && packs.length > 0) {
      try {
        packLines = await packsToLines(packs, local_id);
      } catch (error: any) {
        res.status(400).json({ message: error.message });
        return;
      }
    }

    const data = await prisma.sales.create({
      data: {
        user_id: +user_id,
        date: new Date(),
        local_id,
        shift_id: shift.id,
        total,
        payment_method: method,
        ...splitPayment(method, +total || 0, +payment?.tpe || 0),
      },
    });

    const sale_id = data.id;
    await addProductsAndServicesToStats(
      [...(products || []), ...packLines.products],
      [...(services || []), ...packLines.services],
      +sale_id
    );

    notifySaleCreated(+sale_id);
    res.status(201).json({ message: "Stat registered successfully", data });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
  }
};

export const UpdateStat = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, type, quantity, stat_id, price, frais } = req.body;

  try {
    const before = await prisma.sales.findUnique({
      where: { id: +stat_id },
      select: { total: true },
    });

    if (type === "product") {
      await addProductsAndServicesToStats(
        [
          {
            id: +id,
            quantity: +quantity,
            price: +price,
          },
        ],
        [],
        stat_id
      );
    } else if (type === "service") {
      await addProductsAndServicesToStats(
        [],
        [
          {
            id: +id,
            quantity: +quantity,
            price: +price,
            frais: +frais,
          },
        ],
        stat_id
      );
    }

    await getSaleTotal(+stat_id);

    if (before) {
      notifySaleItemAdded(
        +stat_id,
        before.total,
        type === "product" ? { productId: +id, quantity: +quantity } : undefined
      );
    }
    res.status(201).json({ message: "Stat registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add Stat", error });
    console.log(error);
  }
};

interface SaleProductLine {
  id: number;
  quantity: number;
  price: number;
  pack_name?: string | null;
}

interface SaleServiceLine extends SaleProductLine {
  frais: number;
}

interface PackOrder {
  id: number;
  quantity: number;
  /** pack products kept in the cart (the others are not given / not destocked) */
  products: { id: number; quantity: number }[];
}

/**
 * Splits a pack price between its services, in proportion to their own
 * prices (whole DH, the rounding difference goes to the first service).
 */
const splitPackPrice = (price: number, servicePrices: number[]) => {
  const sum = servicePrices.reduce((a, b) => a + b, 0);
  const shares = servicePrices.map((p, i) =>
    sum > 0 ? Math.floor((price * p) / sum) : i === 0 ? price : 0
  );
  shares[0] += price - shares.reduce((a, b) => a + b, 0);
  return shares;
};

/**
 * Turns the packs of an order into sale lines: the pack's services carry
 * the pack price, its kept products are sold at 0 (they still leave stock).
 * Throws when a pack is unknown or doesn't belong to the local.
 */
const packsToLines = async (packs: PackOrder[], local_id: number) => {
  const services: SaleServiceLine[] = [];
  const products: SaleProductLine[] = [];
  let total = 0;

  for (const order of packs) {
    const quantity = Math.max(1, Math.floor(+order.quantity || 1));
    const pack = await prisma.packs.findUnique({
      where: { id: +order.id },
      include: {
        services: { include: { service: true }, orderBy: { id: "asc" } },
        products: true,
      },
    });

    if (
      !pack ||
      pack.services.length === 0 ||
      pack.services.some((s) => s.service.local_id !== local_id)
    ) {
      throw new Error(`Pack #${order.id} invalide pour ce local`);
    }

    total += pack.price * quantity;
    const shares = splitPackPrice(
      pack.price,
      pack.services.map((s) => s.service.price)
    );
    pack.services.forEach(({ service }, i) => {
      services.push({
        id: service.id,
        quantity,
        price: shares[i],
        frais: service.frais,
        pack_name: pack.name,
      });
    });

    for (const kept of order.products || []) {
      const content = pack.products.find((p) => p.product_id === +kept.id);
      if (!content) continue;
      // never more than the pack holds
      const qty = Math.min(
        Math.max(0, Math.floor(+kept.quantity || 0)),
        content.quantity * quantity
      );
      if (qty > 0) {
        products.push({
          id: content.product_id,
          quantity: qty,
          price: 0,
          pack_name: pack.name,
        });
      }
    }
  }

  return { services, products, total };
};

const addProductsAndServicesToStats = async (
  products: SaleProductLine[],
  services: SaleServiceLine[],
  sale_id: number
) => {
  if (typeof services === "object" && services.length > 0) {
    for (const service of services) {
      await prisma.salesServices.createMany({
        data: {
          sale_id,
          service_id: service.id,
          quantity: service.quantity || 1,
          price: +service.price,
          frais: +service.frais || 0,
          pack_name: service.pack_name || null,
        },
      });
    }
  }
  if (typeof products === "object" && products.length > 0) {
    for (const product of products) {
      await prisma.salesProducts.createMany({
        data: {
          sale_id,
          price: +product.price,
          product_id: product.id,
          quantity: product.quantity || 1,
          pack_name: product.pack_name || null,
        },
      });

      const sale = await prisma.sales.findUnique({
        where: {
          id: +sale_id,
        },
      });

      await addOrReduceStock(
        product.id,
        product.quantity || 1,
        sale?.local_id as number,
        "down"
      );
    }
  }
};

export const deleteSale = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id } = req.params;
  try {
    const deleted = await prisma.sales.findUnique({
      where: { id: +id },
      include: {
        local: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    const sale = await prisma.salesProducts.findMany({
      where: { sale_id: +id },
      include: { sale: true, product: true },
    });

    if (sale.length > 0) {
      sale.forEach(async (item) => {
        await addOrReduceStock(
          item.product.id,
          item.quantity,
          item.sale.local_id,
          "up"
        );
      });
    }

    await prisma.sales.delete({
      where: { id: +id },
    });
    if (deleted) notifySaleDeleted(deleted, req.session.user?.name);
    res.status(200).json({ message: "Sale deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sale", error });
  }
};

export const deleteSaleItem = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, type } = req.body;

  let sale_idd;

  try {
    if (type === "product") {
      const sale = await prisma.salesProducts.delete({
        where: { id: +id },
        include: { sale: true, product: true },
      });

      sale_idd = sale.sale_id;

      await addOrReduceStock(
        sale.product.id,
        sale.quantity,
        sale.sale.local_id,
        "up"
      );
    } else if (type === "service") {
      const sale = await prisma.salesServices.delete({
        where: { id: +id },
      });

      sale_idd = sale.sale_id;
    }

    const id_id = sale_idd;

    await getSaleTotal(id_id as number);
    res.status(200).json({ message: "Sale item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sale item", error });
  }
};

export const handleChangeQuantity = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { id, type, incordec } = req.body;

  let stat;

  try {
    if (type === "product") {
      const sale = await prisma.salesProducts.update({
        where: { id: +id },
        data: {
          quantity: incordec === "inc" ? { increment: 1 } : { decrement: 1 },
        },
        include: { sale: true, product: true },
      });

      stat = sale.sale_id;

      await addOrReduceStock(
        sale.product.id,
        1,
        sale.sale.local_id,
        incordec === "inc" ? "down" : "up"
      );
    } else if (type === "service") {
      const sale = await prisma.salesServices.update({
        where: { id: +id },
        data: {
          quantity: incordec === "inc" ? { increment: 1 } : { decrement: 1 },
        },
      });

      stat = sale.sale_id;
    }

    const id_id = stat;

    await getSaleTotal(id_id as number);
    res.status(200).json({ message: "Sale item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sale item", error });
  }
};

export const fetchAllProdsServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { local_id } = req.query;

  try {
    const prods = await prisma.products.findMany();
    const servs = await prisma.services.findMany({
      where: {
        local_id: +(local_id as string),
      },
    });

    const prods2 = prods.map((item) => ({
      id: item.id,
      name: item.name,
      type: "product",
      price: item.price,
    }));

    const servs2 = servs.map((item) => ({
      id: item.id,
      name: item.name,
      type: "service",
      price: item.price,
    }));

    res.status(201).json({
      message: "Stat registered successfully",
      data: [...(prods2 as any), ...(servs2 as any)],
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete sale item", error });
  }
};

export const getSaleTotal = async (id: number) => {
  try {
    const data = await prisma.sales.findUnique({
      where: {
        id,
      },
      include: {
        products: {
          select: { quantity: true, price: true },
        },
        services: {
          select: { quantity: true, price: true },
        },
      },
    });
    if (!data) return null;

    const totalP = data?.products.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );
    const totalS = data?.services.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0
    );

    const total = totalP + totalS || 0;

    await prisma.sales.update({
      where: {
        id: id,
      },
      data: {
        total,
        ...splitPayment(data.payment_method, total, data.paid_tpe),
      },
    });

    return;
  } catch (error) {
    console.log(error);
    return null;
  }
};
