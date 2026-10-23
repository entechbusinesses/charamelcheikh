import { jsPDF } from "jspdf";
import { format } from "date-fns";

export interface SalesReportData {
  /** One row per local; missing when the server has not been updated yet */
  locals?: {
    local_id: number;
    name: string;
    type: string;
    count: number;
    products: number;
    services: number;
    frais: number;
    cash: number;
    tpe: number;
  }[];
  products: { name: string; quantity: number; total: number }[];
  services: { name: string; quantity: number; total: number; frais: number }[];
  /** Missing when the server has not been updated yet */
  payments?: {
    methods: {
      method: "CASH" | "TPE" | "MIXTE";
      count: number;
      cash: number;
      tpe: number;
      total: number;
    }[];
    cash: number;
    tpe: number;
    total: number;
    count: number;
  };
}

const PAYMENT_LABELS = { CASH: "Espèces", TPE: "TPE (Carte)", MIXTE: "Mixte" };

export interface SalesReportFilters {
  from: string;
  to: string;
  caissier: string;
  local: string;
  paiement: string;
  /** All locals selected: adds the per-local table */
  allLocals?: boolean;
  /** Short version: products / services with quantity, P.U and total + key totals */
  simple?: boolean;
}

// A4 portrait, in mm
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const BOTTOM = PAGE_H - 16; // keep room for the page footer
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 4.2;
const CELL_PAD = 2;

const money = (n: number) => `${n.toFixed(2)} DH`;

interface Column {
  label: string;
  width: number; // mm
  align?: "left" | "right";
}

/**
 * Builds the sales report as a multi-page A4 PDF: rows flow onto new pages
 * automatically and table headers are repeated on each page.
 */
export function buildSalesReportPdf(
  data: SalesReportData,
  filters: SalesReportFilters
): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const printedAt = format(new Date(), "dd/MM/yyyy HH:mm");
  const period = `${format(new Date(filters.from), "dd/MM/yyyy")} au ${format(
    new Date(filters.to),
    "dd/MM/yyyy"
  )}`;
  let y = MARGIN;

  const newPage = () => {
    doc.addPage();
    y = MARGIN;
  };

  const ensureSpace = (h: number) => {
    if (y + h > BOTTOM) {
      newPage();
      return true;
    }
    return false;
  };

  // ---------- Header (first page) ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(17, 24, 39);
  doc.text(
    filters.simple ? "Rapport des Ventes (simplifié)" : "Rapport des Ventes",
    MARGIN,
    y + 6
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text("Gestion Hammam", MARGIN, y + 11.5);

  doc.text("Imprimé le", PAGE_W - MARGIN, y + 4, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  doc.text(printedAt, PAGE_W - MARGIN, y + 9, { align: "right" });

  y += 15;
  doc.setDrawColor(31, 41, 55);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 5;

  // ---------- Applied filters ----------
  const filterRows: [string, string][][] = [
    [
      ["Du : ", format(new Date(filters.from), "dd/MM/yyyy")],
      ["Au : ", format(new Date(filters.to), "dd/MM/yyyy")],
    ],
    [
      ["Caissier : ", filters.caissier],
      ["Local : ", filters.local],
    ],
    [["Paiement : ", filters.paiement]],
  ];
  const boxH = filterRows.length * 6 + 3;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 1.5, 1.5);
  doc.setFontSize(10);
  filterRows.forEach((row, r) => {
    row.forEach(([label, value], c) => {
      const x = MARGIN + 4 + c * (CONTENT_W / 2);
      const ty = y + 6 + r * 6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(label, x, ty);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text(value, x + doc.getTextWidth(label), ty);
    });
  });
  y += boxH + 7;

  // ---------- Table helper ----------
  const drawRow = (
    cols: Column[],
    cells: string[],
    opts: { bold?: boolean; fill?: [number, number, number]; color?: [number, number, number] } = {}
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(9);
    const wrapped = cells.map((cell, i) =>
      doc.splitTextToSize(cell, cols[i].width - CELL_PAD * 2) as string[]
    );
    const lines = Math.max(...wrapped.map((w) => w.length));
    const h = lines * LINE_H + CELL_PAD * 1.6;

    let x = MARGIN;
    cols.forEach((col, i) => {
      if (opts.fill) {
        doc.setFillColor(...opts.fill);
        doc.rect(x, y, col.width, h, "FD");
      } else {
        doc.rect(x, y, col.width, h);
      }
      doc.setTextColor(...(opts.color ?? [17, 24, 39]));
      const tx = col.align === "right" ? x + col.width - CELL_PAD : x + CELL_PAD;
      doc.text(wrapped[i], tx, y + CELL_PAD + 3, {
        align: col.align === "right" ? "right" : "left",
        lineHeightFactor: 1.2,
      });
      x += col.width;
    });
    y += h;
    return h;
  };

  const rowHeight = (cols: Column[], cells: string[]) => {
    doc.setFontSize(9);
    const lines = Math.max(
      ...cells.map(
        (cell, i) =>
          (doc.splitTextToSize(cell, cols[i].width - CELL_PAD * 2) as string[]).length
      )
    );
    return lines * LINE_H + CELL_PAD * 1.6;
  };

  const HEADER_FILL: [number, number, number] = [243, 244, 246];

  const drawTable = (
    title: string,
    cols: Column[],
    rows: string[][],
    emptyText: string,
    totals: string[]
  ) => {
    const headerCells = cols.map((c) => c.label);
    const headerH = rowHeight(cols, headerCells);
    const firstRowH = rows.length ? rowHeight(cols, rows[0]) : 8;

    // keep section title + header + first row together
    ensureSpace(8 + headerH + firstRowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(17, 24, 39);
    doc.text(title.toUpperCase(), MARGIN, y + 4);
    y += 7;

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.2);
    drawRow(cols, headerCells, { bold: true, fill: HEADER_FILL });

    if (rows.length === 0) {
      ensureSpace(8);
      doc.rect(MARGIN, y, CONTENT_W, 8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(emptyText, MARGIN + CONTENT_W / 2, y + 5.3, { align: "center" });
      y += 8;
    }

    rows.forEach((cells) => {
      if (ensureSpace(rowHeight(cols, cells))) {
        // repeat the header on the new page
        drawRow(cols, headerCells, { bold: true, fill: HEADER_FILL });
      }
      drawRow(cols, cells);
    });

    if (ensureSpace(rowHeight(cols, totals))) {
      drawRow(cols, headerCells, { bold: true, fill: HEADER_FILL });
    }
    drawRow(cols, totals, { bold: true, fill: HEADER_FILL });
    y += 8;
  };

  // ---------- Per local (only when all locals are selected) ----------
  if (!filters.simple && filters.allLocals && data.locals?.length) {
    const locals = data.locals;
    const sum = (k: "count" | "products" | "services" | "frais" | "cash" | "tpe") =>
      locals.reduce((s, l) => s + l[k], 0);
    drawTable(
      "Par local (montants en DH)",
      [
        { label: "Local", width: 38 },
        { label: "Tickets", width: 14, align: "right" },
        { label: "Produits", width: 22, align: "right" },
        { label: "Services", width: 22, align: "right" },
        { label: "CA brut", width: 24, align: "right" },
        { label: "Kessal", width: 20, align: "right" },
        { label: "Espèces", width: 23, align: "right" },
        { label: "TPE", width: 23, align: "right" },
      ],
      locals.map((l) => [
        `${l.name} | ${l.type}`,
        String(l.count),
        l.products.toFixed(2),
        l.services.toFixed(2),
        (l.products + l.services).toFixed(2),
        l.frais.toFixed(2),
        l.cash.toFixed(2),
        l.tpe.toFixed(2),
      ]),
      "Aucun ticket",
      [
        "Total",
        String(sum("count")),
        sum("products").toFixed(2),
        sum("services").toFixed(2),
        (sum("products") + sum("services")).toFixed(2),
        sum("frais").toFixed(2),
        sum("cash").toFixed(2),
        sum("tpe").toFixed(2),
      ]
    );
  }

  // ---------- Services ----------
  const totalServices = data.services.reduce((s, x) => s + x.total, 0);
  const totalKessal = data.services.reduce((s, x) => s + x.frais, 0);
  drawTable(
    "Services vendus",
    [
      { label: "Nom", width: CONTENT_W - 20 - 24 - 30 - 30 - 30 },
      { label: "Quantité", width: 20, align: "right" },
      { label: "P.U", width: 24, align: "right" },
      { label: "Frais Kessal", width: 30, align: "right" },
      { label: "Total Brut", width: 30, align: "right" },
      { label: "Total Net", width: 30, align: "right" },
    ],
    data.services.map((s) => [
      s.name,
      String(s.quantity),
      (s.total / s.quantity).toFixed(2),
      money(s.frais),
      money(s.total),
      money(s.total - s.frais),
    ]),
    "Aucun service vendu",
    [
      "Total",
      String(data.services.reduce((s, x) => s + x.quantity, 0)),
      "-",
      money(totalKessal),
      money(totalServices),
      money(totalServices - totalKessal),
    ]
  );

  // ---------- Products ----------
  const totalProduits = data.products.reduce((s, p) => s + p.total, 0);
  drawTable(
    "Produits vendus",
    [
      { label: "Nom", width: CONTENT_W - 25 - 32 - 38 },
      { label: "Quantité", width: 25, align: "right" },
      { label: "P.U", width: 32, align: "right" },
      { label: "Total", width: 38, align: "right" },
    ],
    data.products.map((p) => [
      p.name,
      String(p.quantity),
      (p.total / p.quantity).toFixed(2),
      money(p.total),
    ]),
    "Aucun produit vendu",
    [
      "Total",
      String(data.products.reduce((s, p) => s + p.quantity, 0)),
      "-",
      money(totalProduits),
    ]
  );

  // ---------- Payment methods ----------
  const payments = data.payments;
  if (payments && !filters.simple) {
    drawTable(
      "Modes de paiement",
      [
        { label: "Mode", width: CONTENT_W - 26 - 36 - 36 - 38 },
        { label: "Tickets", width: 26, align: "right" },
        { label: "Espèces", width: 36, align: "right" },
        { label: "TPE", width: 36, align: "right" },
        { label: "Total", width: 38, align: "right" },
      ],
      payments.methods.map((m) => [
        PAYMENT_LABELS[m.method],
        String(m.count),
        money(m.cash),
        money(m.tpe),
        money(m.total),
      ]),
      "Aucun ticket",
      [
        "Total",
        String(payments.count),
        money(payments.cash),
        money(payments.tpe),
        money(payments.total),
      ]
    );
  }

  // ---------- Summary (kept on one page) ----------
  const summaryCols: Column[] = [
    { label: "", width: CONTENT_W - 50 },
    { label: "", width: 50, align: "right" },
  ];
  const simpleSummary: [string, string][] = [
    ...(payments
      ? ([["Nombre de tickets", String(payments.count)]] as [string, string][])
      : []),
    ["Total Services", money(totalServices)],
    ["Total Produits", money(totalProduits)],
    ...(payments
      ? ([
          ["Encaissé en espèces", money(payments.cash)],
          ["Encaissé par TPE", money(payments.tpe)],
        ] as [string, string][])
      : []),
    ["Total Brut", money(totalProduits + totalServices)],
    ["Total Frais Kessal", `- ${money(totalKessal)}`],
  ];
  const fullSummary: [string, string][] = [
    ["Total Produits", money(totalProduits)],
    ["Total Services", money(totalServices)],
    ["Chiffre d'affaires brut", money(totalProduits + totalServices)],
    // cash + TPE together make up the gross turnover
    ...(payments
      ? ([
          ["   dont encaissé en espèces", money(payments.cash)],
          ["   dont encaissé par TPE", money(payments.tpe)],
        ] as [string, string][])
      : []),
    ["Total Frais Kessal", `- ${money(totalKessal)}`],
  ];
  const summary = filters.simple ? simpleSummary : fullSummary;
  ensureSpace(7 + (summary.length + 1) * 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(17, 24, 39);
  doc.text("RÉSUMÉ", MARGIN, y + 4);
  y += 7;
  doc.setDrawColor(209, 213, 219);
  summary.forEach((row) => drawRow(summaryCols, row));
  drawRow(
    summaryCols,
    ["Total Net", money(totalProduits + totalServices - totalKessal)],
    { bold: true, fill: HEADER_FILL }
  );

  // ---------- Footer on every page ----------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, PAGE_H - 11, PAGE_W - MARGIN, PAGE_H - 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Rapport des ventes du ${period} — imprimé le ${printedAt}`, MARGIN, PAGE_H - 7);
    doc.text(`Page ${p} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
  }

  return doc;
}
