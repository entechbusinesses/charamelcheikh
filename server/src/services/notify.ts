// Admin push notifications for business events (shifts, clôtures, sales, stock).
// Every function here is fire-and-forget: a push failure never breaks the request.
import { prisma } from "../app";
import { PushPayload, sendToAdmins } from "./push.service";

/** Orders above this total (dh) trigger a "grosse commande" notification */
export const BIG_ORDER_AMOUNT = 500;
/** A product whose stock drops to this quantity or below triggers a stock alert */
export const LOW_STOCK_QUANTITY = 5;

const TZ = "Africa/Casablanca";

const dh = (n: number) =>
  `${(Math.round(n * 100) / 100).toLocaleString("fr-FR")} dh`;

const time = (d: Date) =>
  d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

const day = (d: Date) =>
  d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: TZ });

const duration = (from: Date, to: Date) => {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
};

const notify = (payload: PushPayload) => {
  sendToAdmins(payload).catch((error) =>
    console.error("[push] failed to notify admins:", error)
  );
};

/** Runs a notification builder in the background and logs its errors */
const background = (build: () => Promise<void>) => {
  build().catch((error) => console.error("[push] notification error:", error));
};

// ─── Shifts ──────────────────────────────────────────────────────────────

export const notifyShiftStarted = (shift: {
  id: number;
  opened_at: Date;
  fond_caisse: number;
  user: { name: string };
  local: { name: string; type: string };
}) =>
  notify({
    title: `🟢 Shift démarré · ${shift.local.name}`,
    body: `${shift.user.name} a ouvert la caisse à ${time(shift.opened_at)}\nFond de caisse : ${dh(shift.fond_caisse)}`,
    url: "/shifts",
    tag: `shift-${shift.id}`,
  });

export const notifyShiftClosed = (
  shift: {
    id: number;
    opened_at: Date;
    closed_at: Date | null;
    fond_caisse: number;
    user: { name: string };
    local: { name: string };
  },
  summary: { count: number; total: number; cash: number; tpe: number },
  closedBy?: string
) => {
  const closedAt = shift.closed_at || new Date();
  const byOther = closedBy && closedBy !== shift.user.name ? ` (fermé par ${closedBy})` : "";
  notify({
    title: `🔴 Shift terminé · ${shift.local.name}`,
    body:
      `${shift.user.name}${byOther} · ${time(shift.opened_at)} → ${time(closedAt)} (${duration(shift.opened_at, closedAt)})\n` +
      `${summary.count} vente(s) · Total ${dh(summary.total)}\n` +
      `Espèces ${dh(summary.cash)} · TPE ${dh(summary.tpe)} · Caisse ${dh(shift.fond_caisse + summary.cash)}`,
    url: "/shifts",
    tag: `shift-${shift.id}`,
  });
};

// ─── Clôture ─────────────────────────────────────────────────────────────

export const notifyCloture = (totalDayId: number, previousTotal?: number) =>
  background(async () => {
    const row = await prisma.totalDay.findUnique({
      where: { id: totalDayId },
      include: { local: { select: { name: true } }, user: { select: { name: true } } },
    });
    if (!row) return;

    const edited = previousTotal !== undefined;
    notify({
      title: `${edited ? "✏️ Clôture modifiée" : "📒 Clôture"} · ${row.local.name}`,
      body:
        `${row.user.name} · journée du ${day(row.date)}\n` +
        (edited && previousTotal !== row.total
          ? `Total : ${dh(previousTotal)} → ${dh(row.total)}\n`
          : `Total : ${dh(row.total)}\n`) +
        `Services ${dh(row.total_services)} · Produits ${dh(row.total_products)}`,
      url: "/cloture/list",
      tag: `cloture-${row.id}`,
    });
  });

// ─── Sales ───────────────────────────────────────────────────────────────

const loadSale = (id: number) =>
  prisma.sales.findUnique({
    where: { id },
    include: {
      local: { select: { name: true, type: true } },
      user: { select: { name: true } },
      products: { include: { product: { select: { name: true } } } },
      services: { select: { quantity: true } },
    },
  });

type LoadedSale = NonNullable<Awaited<ReturnType<typeof loadSale>>>;

const productsText = (lines: { quantity: number; product: { name: string } }[]) => {
  const parts = lines.map((l) => `${l.quantity}× ${l.product.name}`);
  return parts.length > 4 ? `${parts.slice(0, 4).join(", ")}…` : parts.join(", ");
};

const paymentText = (sale: LoadedSale) =>
  sale.payment_method === "MIXTE"
    ? `Mixte (${dh(sale.paid_cash)} esp. + ${dh(sale.paid_tpe)} TPE)`
    : sale.payment_method === "TPE"
    ? "TPE"
    : "Espèces";

/**
 * After a sale is created: big order (> BIG_ORDER_AMOUNT) and/or products
 * sold in a Beldi local. Both in one notification when both apply.
 */
export const notifySaleCreated = (saleId: number) =>
  background(async () => {
    const sale = await loadSale(saleId);
    if (!sale) return;

    const big = sale.total > BIG_ORDER_AMOUNT;
    const beldiProducts = sale.local.type === "BELDI" && sale.products.length > 0;
    if (!big && !beldiProducts) return;

    const title = big
      ? `💰 Grosse commande ${dh(sale.total)} · ${sale.local.name}`
      : `🛍️ Achat produits · ${sale.local.name}`;

    const lines = [`Ticket #${sale.id} · ${sale.user.name} · ${paymentText(sale)}`];
    if (sale.products.length) lines.push(`Produits : ${productsText(sale.products)}`);
    if (sale.services.length) lines.push(`${sale.services.reduce((s, x) => s + x.quantity, 0)} service(s)`);
    if (!big) lines.push(`Total ${dh(sale.total)}`);

    notify({ title, body: lines.join("\n"), url: "/tickets", tag: `sale-${sale.id}` });
  });

/**
 * After an item is added to an existing ticket: notifies when the ticket
 * crosses BIG_ORDER_AMOUNT, or when a product is added in a Beldi local.
 */
export const notifySaleItemAdded = (
  saleId: number,
  previousTotal: number,
  added?: { productId: number; quantity: number }
) =>
  background(async () => {
    const sale = await loadSale(saleId);
    if (!sale) return;

    const crossedBig = previousTotal <= BIG_ORDER_AMOUNT && sale.total > BIG_ORDER_AMOUNT;
    const addedLine = added && sale.products.find((l) => l.product_id === added.productId);
    const beldiProduct = sale.local.type === "BELDI" && !!addedLine;
    if (!crossedBig && !beldiProduct) return;

    if (crossedBig) {
      notify({
        title: `💰 Grosse commande ${dh(sale.total)} · ${sale.local.name}`,
        body: `Ticket #${sale.id} · ${sale.user.name} · ${paymentText(sale)}\n` +
          (sale.products.length ? `Produits : ${productsText(sale.products)}` : "Services uniquement"),
        url: "/tickets",
        tag: `sale-${sale.id}`,
      });
      return;
    }

    notify({
      title: `🛍️ Achat produits · ${sale.local.name}`,
      body: `Ticket #${sale.id} · ${sale.user.name}\nAjout : ${added!.quantity}× ${addedLine!.product.name}\nTotal ${dh(sale.total)}`,
      url: "/tickets",
      tag: `sale-${sale.id}`,
    });
  });

export const notifySaleDeleted = (
  sale: { id: number; total: number; date: Date; local: { name: string }; user: { name: string } },
  deletedBy?: string
) =>
  notify({
    title: `🗑️ Ticket supprimé · ${sale.local.name}`,
    body:
      `Ticket #${sale.id} de ${dh(sale.total)} (${sale.user.name}, ${day(sale.date)} ${time(sale.date)})\n` +
      `Supprimé par ${deletedBy || "inconnu"}`,
    url: "/tickets",
  });

// ─── Stock ───────────────────────────────────────────────────────────────

export const notifyReception = (receptionId: number, productsCount: number) =>
  background(async () => {
    const r = await prisma.receptionList.findUnique({
      where: { id: receptionId },
      include: {
        from: { select: { name: true } },
        to: { select: { name: true } },
        user: { select: { name: true } },
      },
    });
    if (!r) return;

    notify({
      title: r.isBough ? `🧾 Achat fournisseur · ${r.to.name}` : `🚚 Transfert de stock · ${r.to.name}`,
      body:
        (r.isBough ? `${r.user.name} a reçu un achat` : `${r.from?.name || "?"} → ${r.to.name} par ${r.user.name}`) +
        `\n${productsCount} produit(s)${r.total ? ` · Total ${dh(r.total)}` : ""}` +
        (r.description ? `\n${r.description}` : ""),
      url: "/reception",
      tag: `reception-${r.id}`,
    });
  });

/** Called after a stock decrease: alerts only when the quantity crosses the threshold */
export const notifyLowStock = (
  productId: number,
  localId: number,
  before: number,
  after: number
) => {
  if (!(before > LOW_STOCK_QUANTITY && after <= LOW_STOCK_QUANTITY)) return;

  background(async () => {
    const [product, local] = await Promise.all([
      prisma.products.findUnique({ where: { id: productId }, select: { name: true } }),
      prisma.locals.findUnique({ where: { id: localId }, select: { name: true } }),
    ]);
    if (!product || !local) return;

    notify({
      title: after <= 0 ? `⛔ Rupture de stock · ${local.name}` : `⚠️ Stock bas · ${local.name}`,
      body: `${product.name} : ${after <= 0 ? "plus aucune unité" : `il reste ${after} unité(s)`}`,
      url: "/products",
      tag: `stock-${productId}-${localId}`,
    });
  });
};
