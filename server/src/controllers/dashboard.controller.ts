import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../app";

// A business day starts at 05:00 (same cut-off as tickets and clôture)
const DAY_START_HOUR = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const num = (v: unknown) => Number(v ?? 0) || 0;

/** "YYYY-MM-DD" -> Date at 05:00 local time */
const dayStart = (ymd: string) => {
  const d = new Date(ymd);
  d.setHours(DAY_START_HOUR, 0, 0, 0);
  return d;
};

/** Business-day key of a date ("YYYY-MM-DD") */
const dayKey = (date: Date) => {
  const d = new Date(date.getTime() - DAY_START_HOUR * 60 * 60 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type PaymentMethod = "CASH" | "TPE" | "MIXTE";
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "TPE", "MIXTE"];

/**
 * All aggregation happens in MySQL (GROUP BY) so only small result sets travel:
 * the sales tables are far too large to load row by row.
 */
export const DashboardStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { from, to, local_id } = req.query as Record<string, string | undefined>;

  try {
    // Range: [from 05:00, (to + 1 day) 05:00) - "to" is inclusive
    const today = dayKey(new Date());
    const start = dayStart(from || `${today.slice(0, 7)}-01`);
    const end = new Date(dayStart(to || today).getTime() + DAY_MS);
    const prevStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

    // 12 months of history for the growth chart (always ends with the range)
    const historyStart = new Date(end);
    historyStart.setMonth(historyStart.getMonth() - 12);
    historyStart.setDate(1);
    historyStart.setHours(DAY_START_HOUR, 0, 0, 0);

    // Dates are stored in UTC: shift them to local time (and to the 05:00 day start)
    const offset = -new Date().getTimezoneOffset();
    const localDate = Prisma.sql`DATE_ADD(s.date, INTERVAL ${Prisma.raw(String(offset))} MINUTE)`;
    const businessDate = Prisma.sql`DATE_ADD(s.date, INTERVAL ${Prisma.raw(String(offset - DAY_START_HOUR * 60))} MINUTE)`;
    const dayExpr = Prisma.sql`DATE_FORMAT(${businessDate}, '%Y-%m-%d')`;
    const monthExpr = Prisma.sql`DATE_FORMAT(${businessDate}, '%Y-%m')`;
    const hourExpr = Prisma.sql`HOUR(${localDate})`;

    const local = local_id && local_id !== "tous" ? +local_id : null;
    const where = (a: Date, b: Date) =>
      Prisma.sql`s.date >= ${a} AND s.date < ${b} ${
        local ? Prisma.sql`AND s.local_id = ${local}` : Prisma.empty
      }`;

    // Weighted average purchase price per product, from "achat" receptions
    const costs = Prisma.sql`(
      SELECT rp.product_id, SUM(rp.price * rp.quantity) / SUM(rp.quantity) AS cost
      FROM reception_products rp
      JOIN reception_list rl ON rl.id = rp.reception_id
      WHERE rl.isBough = 1
      GROUP BY rp.product_id
      HAVING SUM(rp.quantity) > 0
    )`;

    const productLines = (group: Prisma.Sql, a: Date, b: Date) =>
      prisma.$queryRaw<any[]>`
        SELECT ${group},
          SUM(sp.price * sp.quantity) AS revenue,
          SUM(COALESCE(c.cost, 0) * sp.quantity) AS cost,
          SUM(sp.quantity) AS qty
        FROM sales_products sp
        JOIN sales s ON s.id = sp.sale_id
        LEFT JOIN ${costs} c ON c.product_id = sp.product_id
        WHERE ${where(a, b)}
        GROUP BY k1, k2, k3, k4`;

    const serviceLines = (group: Prisma.Sql, a: Date, b: Date) =>
      prisma.$queryRaw<any[]>`
        SELECT ${group},
          SUM(ss.price * ss.quantity) AS revenue,
          SUM(ss.frais * ss.quantity) AS frais,
          SUM(ss.quantity) AS qty
        FROM sales_services ss
        JOIN sales s ON s.id = ss.sale_id
        WHERE ${where(a, b)}
        GROUP BY k1, k2, k3, k4`;

    const salesRows = (group: Prisma.Sql, a: Date, b: Date) =>
      prisma.$queryRaw<any[]>`
        SELECT ${group}, s.payment_method AS pm,
          COUNT(*) AS n, SUM(s.total) AS total,
          SUM(s.paid_cash) AS cash, SUM(s.paid_tpe) AS tpe
        FROM sales s
        WHERE ${where(a, b)}
        GROUP BY k1, k2, k3, k4, pm`;

    // Grouping keys (always 4 columns so the helpers stay generic)
    const fine = Prisma.sql`${dayExpr} AS k1, ${hourExpr} AS k2, s.local_id AS k3, s.user_id AS k4`;
    const byProduct = Prisma.sql`sp.product_id AS k1, 0 AS k2, 0 AS k3, 0 AS k4`;
    const byService = Prisma.sql`ss.service_id AS k1, 0 AS k2, 0 AS k3, 0 AS k4`;
    const byMonth = Prisma.sql`${monthExpr} AS k1, 0 AS k2, 0 AS k3, 0 AS k4`;
    const none = Prisma.sql`0 AS k1, 0 AS k2, 0 AS k3, 0 AS k4`;

    const [
      salesFine,
      prodFine,
      servFine,
      prodById,
      servById,
      salesMonth,
      prodMonth,
      servMonth,
      salesPrev,
      prodPrev,
      servPrev,
      knownCosts,
      products,
      services,
      locals,
      users,
    ] = await Promise.all([
      salesRows(fine, start, end),
      productLines(fine, start, end),
      serviceLines(fine, start, end),
      productLines(byProduct, start, end),
      serviceLines(byService, start, end),
      salesRows(byMonth, historyStart, end),
      productLines(byMonth, historyStart, end),
      serviceLines(byMonth, historyStart, end),
      salesRows(none, prevStart, start),
      productLines(none, prevStart, start),
      serviceLines(none, prevStart, start),
      prisma.$queryRaw<{ product_id: number }[]>`SELECT product_id FROM ${costs} c`,
      prisma.products.findMany({
        select: { id: true, name: true, category: { select: { name: true } } },
      }),
      prisma.services.findMany({ select: { id: true, name: true } }),
      prisma.locals.findMany({ select: { id: true, name: true, type: true } }),
      prisma.user.findMany({ select: { id: true, name: true } }),
    ]);

    // ---- Summaries (current & previous period)
    const summarize = (sales: any[], prods: any[], servs: any[]) => {
      const productsRev = prods.reduce((a, r) => a + num(r.revenue), 0);
      const servicesRev = servs.reduce((a, r) => a + num(r.revenue), 0);
      const profit =
        prods.reduce((a, r) => a + num(r.revenue) - num(r.cost), 0) +
        servs.reduce((a, r) => a + num(r.revenue) - num(r.frais), 0);
      const tickets = sales.reduce((a, r) => a + num(r.n), 0);
      const items =
        prods.reduce((a, r) => a + num(r.qty), 0) +
        servs.reduce((a, r) => a + num(r.qty), 0);
      const revenue = productsRev + servicesRev;
      return {
        revenue: round2(revenue),
        products: round2(productsRev),
        services: round2(servicesRev),
        profit: round2(profit),
        tickets,
        items,
        avgTicket: tickets ? round2(revenue / tickets) : 0,
      };
    };

    // ---- Daily series (every day of the range, even without sales)
    const daily = new Map<
      string,
      { date: string; products: number; services: number; total: number; profit: number; tickets: number }
    >();
    for (let t = start.getTime(); t < end.getTime(); t += DAY_MS) {
      const key = dayKey(new Date(t + 60 * 60 * 1000));
      daily.set(key, { date: key, products: 0, services: 0, total: 0, profit: 0, tickets: 0 });
    }

    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, tickets: 0 }));
    // Monday first
    const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => ({
      day,
      revenue: 0,
      tickets: 0,
    }));
    const weekdayOf = (day: string) => (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
    const byLocal = new Map<number, { revenue: number; tickets: number }>();
    const byUser = new Map<number, { revenue: number; tickets: number }>();
    const bump = (m: Map<number, { revenue: number; tickets: number }>, id: number, revenue: number, tickets: number) => {
      const row = m.get(id) ?? { revenue: 0, tickets: 0 };
      row.revenue += revenue;
      row.tickets += tickets;
      m.set(id, row);
    };

    // Revenue lines (products & services)
    const addRevenue = (r: any, revenue: number, profit: number, kind: "products" | "services") => {
      const day = daily.get(String(r.k1));
      if (day) {
        day[kind] += revenue;
        day.total += revenue;
        day.profit += profit;
      }
      hours[num(r.k2)].revenue += revenue;
      weekdays[weekdayOf(String(r.k1))].revenue += revenue;
      bump(byLocal, num(r.k3), revenue, 0);
      bump(byUser, num(r.k4), revenue, 0);
    };
    prodFine.forEach((r) => addRevenue(r, num(r.revenue), num(r.revenue) - num(r.cost), "products"));
    servFine.forEach((r) => addRevenue(r, num(r.revenue), num(r.revenue) - num(r.frais), "services"));

    // Tickets & payment methods
    const payments: Record<PaymentMethod, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      TPE: { count: 0, total: 0 },
      MIXTE: { count: 0, total: 0 },
    };
    let cash = 0;
    let tpe = 0;
    salesFine.forEach((r) => {
      const n = num(r.n);
      const day = daily.get(String(r.k1));
      if (day) day.tickets += n;
      hours[num(r.k2)].tickets += n;
      weekdays[weekdayOf(String(r.k1))].tickets += n;
      bump(byLocal, num(r.k3), 0, n);
      bump(byUser, num(r.k4), 0, n);

      const pm = (PAYMENT_METHODS.includes(r.pm) ? r.pm : "CASH") as PaymentMethod;
      payments[pm].count += n;
      payments[pm].total += num(r.total);
      if (pm === "MIXTE") {
        cash += num(r.cash);
        tpe += num(r.tpe);
      } else if (pm === "TPE") {
        tpe += num(r.total);
      } else {
        cash += num(r.total);
      }
    });

    // ---- 12-month growth
    const monthly = new Map<string, { month: string; revenue: number; profit: number; tickets: number }>();
    for (
      let m = new Date(historyStart);
      m < end;
      m = new Date(m.getFullYear(), m.getMonth() + 1, 1, DAY_START_HOUR)
    ) {
      const key = `${m.getFullYear()}-${pad(m.getMonth() + 1)}`;
      monthly.set(key, { month: key, revenue: 0, profit: 0, tickets: 0 });
    }
    prodMonth.forEach((r) => {
      const row = monthly.get(String(r.k1));
      if (!row) return;
      row.revenue += num(r.revenue);
      row.profit += num(r.revenue) - num(r.cost);
    });
    servMonth.forEach((r) => {
      const row = monthly.get(String(r.k1));
      if (!row) return;
      row.revenue += num(r.revenue);
      row.profit += num(r.revenue) - num(r.frais);
    });
    salesMonth.forEach((r) => {
      const row = monthly.get(String(r.k1));
      if (row) row.tickets += num(r.n);
    });

    // ---- Products / services / categories
    const costKnown = new Set(knownCosts.map((c) => num(c.product_id)));
    const productInfo = new Map(products.map((p) => [p.id, p]));
    const productRows = prodById
      .map((r) => {
        const id = num(r.k1);
        return {
          id,
          name: productInfo.get(id)?.name ?? `#${id}`,
          category: productInfo.get(id)?.category.name ?? "—",
          quantity: num(r.qty),
          revenue: round2(num(r.revenue)),
          cost: round2(num(r.cost)),
          profit: round2(num(r.revenue) - num(r.cost)),
          costKnown: costKnown.has(id),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const categories = new Map<string, { revenue: number; profit: number }>();
    productRows.forEach((p) => {
      const c = categories.get(p.category) ?? { revenue: 0, profit: 0 };
      c.revenue += p.revenue;
      c.profit += p.profit;
      categories.set(p.category, c);
    });

    const serviceName = new Map(services.map((s) => [s.id, s.name]));
    const localName = new Map(locals.map((l) => [l.id, `${l.name} (${l.type})`]));
    const userName = new Map(users.map((u) => [u.id, u.name]));

    res.json({
      data: {
        range: { from: dayKey(start), to: dayKey(new Date(end.getTime() - DAY_MS)) },
        summary: summarize(salesFine, prodFine, servFine),
        previous: summarize(salesPrev, prodPrev, servPrev),
        daily: Array.from(daily.values()).map((d) => ({
          ...d,
          products: round2(d.products),
          services: round2(d.services),
          total: round2(d.total),
          profit: round2(d.profit),
        })),
        monthly: Array.from(monthly.values()).map((m) => ({
          ...m,
          revenue: round2(m.revenue),
          profit: round2(m.profit),
        })),
        products: productRows,
        services: servById
          .map((r) => {
            const id = num(r.k1);
            return {
              id,
              name: serviceName.get(id) ?? `#${id}`,
              quantity: num(r.qty),
              revenue: round2(num(r.revenue)),
              frais: round2(num(r.frais)),
              profit: round2(num(r.revenue) - num(r.frais)),
            };
          })
          .sort((a, b) => b.revenue - a.revenue),
        categories: Array.from(categories, ([name, c]) => ({
          name,
          revenue: round2(c.revenue),
          profit: round2(c.profit),
        })).sort((a, b) => b.revenue - a.revenue),
        hours: hours.map((h) => ({ ...h, revenue: round2(h.revenue) })),
        weekdays: weekdays.map((w) => ({ ...w, revenue: round2(w.revenue) })),
        locals: Array.from(byLocal, ([id, r]) => ({
          id,
          name: localName.get(id) ?? `#${id}`,
          revenue: round2(r.revenue),
          tickets: r.tickets,
        })).sort((a, b) => b.revenue - a.revenue),
        users: Array.from(byUser, ([id, r]) => ({
          id,
          name: userName.get(id) ?? `#${id}`,
          revenue: round2(r.revenue),
          tickets: r.tickets,
        })).sort((a, b) => b.revenue - a.revenue),
        payments: {
          methods: PAYMENT_METHODS.map((m) => ({
            method: m,
            count: payments[m].count,
            total: round2(payments[m].total),
          })),
          cash: round2(cash),
          tpe: round2(tpe),
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to build dashboard stats", error: String(error) });
  }
};
