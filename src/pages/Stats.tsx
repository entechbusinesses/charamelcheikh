import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  Receipt,
  ShoppingBasket,
  Package,
  Loader2,
  AlertTriangle,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  type TooltipProps,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";
import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import Title from "@/components/ui/Title";
import { cn } from "@/lib/utils";
import { LoadingSpinning } from "@/components/ui/loadingspining";

// ---------- Palette (validated categorical order, light surface)
const C = {
  products: "#2a78d6", // slot 1 blue
  services: "#eb6834", // slot 2 orange
  profit: "#1baf7a", // slot 3 aqua
  previous: "#c3c2b7", // neutral – comparison period
  grid: "#e1e0d9",
  axis: "#898781",
};
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
const PAYMENT_COLORS: Record<string, string> = { CASH: "#2a78d6", TPE: "#eb6834", MIXTE: "#1baf7a" };
const PAYMENT_LABEL: Record<string, string> = { CASH: "Espèces", TPE: "TPE", MIXTE: "Mixte" };

// ---------- Types
interface Summary {
  revenue: number;
  products: number;
  services: number;
  profit: number;
  tickets: number;
  items: number;
  avgTicket: number;
}
interface Dashboard {
  range: { from: string; to: string };
  summary: Summary;
  previous: Summary;
  daily: { date: string; products: number; services: number; total: number; profit: number; tickets: number }[];
  monthly: { month: string; revenue: number; profit: number; tickets: number }[];
  products: {
    id: number;
    name: string;
    category: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
    costKnown: boolean;
  }[];
  services: { id: number; name: string; quantity: number; revenue: number; frais: number; profit: number }[];
  categories: { name: string; revenue: number; profit: number }[];
  hours: { hour: number; revenue: number; tickets: number }[];
  weekdays: { day: string; revenue: number; tickets: number }[];
  locals: { id: number; name: string; revenue: number; tickets: number }[];
  users: { id: number; name: string; revenue: number; tickets: number }[];
  payments: { methods: { method: string; count: number; total: number }[]; cash: number; tpe: number };
}

// ---------- Helpers
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
const money = (n: number) => `${nf.format(n)} DH`;
const compact = (n: number) =>
  Math.abs(n) >= 1000 ? `${nf.format(Math.round(n / 100) / 10)}k` : nf.format(Math.round(n));
const ymd = (d: Date) => format(d, "yyyy-MM-dd");
const dayLabel = (s: string) => format(new Date(`${s}T12:00:00`), "d MMM", { locale: fr });
const monthLabel = (s: string) => format(new Date(`${s}-15T12:00:00`), "MMM yy", { locale: fr });
const pct = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / Math.abs(prev)) * 100);

type PresetKey = "month" | "lastMonth" | "7d" | "30d" | "90d" | "custom";
const PRESETS: { key: Exclude<PresetKey, "custom">; label: string; range: () => [Date, Date] }[] = [
  { key: "month", label: "Ce mois", range: () => [startOfMonth(new Date()), new Date()] },
  {
    key: "lastMonth",
    label: "Mois dernier",
    range: () => {
      const m = subMonths(new Date(), 1);
      return [startOfMonth(m), endOfMonth(m)];
    },
  },
  { key: "7d", label: "7 jours", range: () => [subDays(new Date(), 6), new Date()] },
  { key: "30d", label: "30 jours", range: () => [subDays(new Date(), 29), new Date()] },
  { key: "90d", label: "90 jours", range: () => [subDays(new Date(), 89), new Date()] },
];

// ---------- Small building blocks
function Panel({
  title,
  subtitle,
  children,
  className,
  legend,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  legend?: { label: string; color: string; dashed?: boolean }[];
}) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {legend && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {legend.map((l) => (
              <span key={l.label} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={
                    l.dashed
                      ? { border: `2px dashed ${l.color}`, background: "transparent" }
                      : { background: l.color }
                  }
                />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const p = pct(cur, prev);
  if (p === null) return <span className="text-xs text-slate-400">nouveau</span>;
  const up = p > 0.05;
  const down = p < -0.05;
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        up ? "bg-emerald-50 text-emerald-700" : down ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
      )}
    >
      <Icon className="size-3.5" />
      {p > 0 ? "+" : ""}
      {nf.format(Math.round(p * 10) / 10)}%
    </span>
  );
}

function Kpi({
  label,
  value,
  cur,
  prev,
  icon: Icon,
  spark,
  color,
}: {
  label: string;
  value: string;
  cur: number;
  prev: number;
  icon: typeof Wallet;
  spark?: number[];
  color: string;
}) {
  const data = spark?.map((v, i) => ({ i, v }));
  const gradientId = `spark${useId().replace(/:/g, "")}`;
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 pb-0 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <span className="flex size-9 items-center justify-center rounded-xl bg-slate-50 text-slate-600">
          <Icon className="size-[18px]" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-2 flex items-center gap-2">
        <Delta cur={cur} prev={prev} />
        <span className="text-xs text-slate-400">vs période préc.</span>
      </div>
      {data && data.length > 1 ? (
        <div className="pointer-events-none -mx-5 mt-3 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
}

/** Shared tooltip: label + one row per series, text stays in ink colors */
function ChartTooltip({
  active,
  payload,
  label,
  labelFormat,
  valueFormat = money,
}: TooltipProps<number, string> & { labelFormat?: (l: any) => string; valueFormat?: (n: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[160px] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-semibold text-slate-900">{labelFormat ? labelFormat(label) : label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-0.5">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="h-2 w-2 rounded-full" style={{ background: (p.color || (p.payload as any)?.fill) as string }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-slate-900">{valueFormat(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}

const axisProps = {
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function Empty({ h = 260 }: { h?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: h }}>
      Aucune donnée sur la période
    </div>
  );
}

function Donut({
  data,
  total,
  centerLabel,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const shown = data.filter((d) => d.value > 0);
  if (!shown.length) return <Empty h={220} />;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              cornerRadius={4}
              stroke="#fff"
              strokeWidth={2}
            >
              {shown.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-slate-500">{centerLabel}</span>
          <span className="text-base font-semibold text-slate-900">{compact(total)}</span>
        </div>
      </div>
      <ul className="w-full space-y-2 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-900">
              {money(d.value)}
              <span className="ml-1.5 text-xs text-slate-400">
                {total ? Math.round((d.value / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Page
export default function Stats() {
  const [preset, setPreset] = useState<PresetKey>("month");
  const [from, setFrom] = useState(ymd(startOfMonth(new Date())));
  const [to, setTo] = useState(ymd(new Date()));
  const [local, setLocal] = useState("tous");
  const [locals, setLocals] = useState<{ id: number; name: string; type?: string }[]>([]);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [productMetric, setProductMetric] = useState<"revenue" | "quantity">("revenue");

  useEffect(() => {
    api
      .get("/locals/list")
      .then((r) => setLocals(r.data.data ?? []))
      .catch(() => setLocals([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get("/sales/dashboard", { params: { from, to, local_id: local } })
      .then((r) => {
        if (!cancelled) setData(r.data.data);
      })
      .catch((err) => !cancelled && notifyError(err, "Impossible de charger les statistiques."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [from, to, local]);

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (p) {
      const [a, b] = p.range();
      setFrom(ymd(a));
      setTo(ymd(b));
    }
  };

  const derived = useMemo(() => {
    if (!data) return null;
    let run = 0;
    const cumulative = data.daily.map((d) => {
      run += d.total;
      return { date: d.date, cumul: Math.round(run * 100) / 100 };
    });
    const avgDay = data.daily.length ? data.summary.revenue / data.daily.length : 0;
    const best = data.daily.reduce((b, d) => (d.total > (b?.total ?? -1) ? d : b), data.daily[0]);
    const margin = data.summary.revenue ? (data.summary.profit / data.summary.revenue) * 100 : 0;
    const prevMargin = data.previous.revenue ? (data.previous.profit / data.previous.revenue) * 100 : 0;
    const missingCost = data.products.filter((p) => !p.costKnown).length;
    const topProducts = [...data.products]
      .sort((a, b) => b[productMetric] - a[productMetric])
      .slice(0, 10);
    const hours = data.hours.filter((h) => h.hour >= 6 || h.revenue > 0);
    return { cumulative, avgDay, best, margin, prevMargin, missingCost, topProducts, hours };
  }, [data, productMetric]);

  const s = data?.summary;
  const p = data?.previous;

  return (
    <div className="px-4 pb-10 font-poppins md:px-2">
      <Title
        title="Statistiques"
        description="Chiffre d'affaires, bénéfices et évolution de l'activité"
        Icon={BarChart3}
      />

      {/* Filters – one row above all charts */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          {PRESETS.map((pr) => (
            <button
              key={pr.key}
              onClick={() => applyPreset(pr.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                preset === pr.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"
              )}
            >
              {pr.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => {
              setPreset("custom");
              setFrom(e.target.value);
            }}
            className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => {
              setPreset("custom");
              setTo(e.target.value);
            }}
            className="h-9 rounded-lg border border-slate-200 px-2 text-sm text-slate-700"
          />
          <select
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
          >
            <option value="tous">Tous les locaux</option>
            {locals.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
                {l.type ? ` (${l.type})` : ""}
              </option>
            ))}
          </select>
          {loading && <Loader2 className="size-4 animate-spin text-slate-400" />}
        </div>
      </div>

      {!data || !s || !p || !derived ? (
        loading ? (
          <LoadingSpinning label="Chargement des statistiques…" />
        ) : null
      ) : (
        <div className={cn("space-y-6 transition-opacity", loading && "opacity-60")}>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label="Chiffre d'affaires"
              value={money(s.revenue)}
              cur={s.revenue}
              prev={p.revenue}
              icon={Wallet}
              spark={data.daily.map((d) => d.total)}
              color={C.products}
            />
            <Kpi
              label="Bénéfice"
              value={money(s.profit)}
              cur={s.profit}
              prev={p.profit}
              icon={PiggyBank}
              spark={data.daily.map((d) => d.profit)}
              color={C.profit}
            />
            <Kpi
              label="Tickets"
              value={nf.format(s.tickets)}
              cur={s.tickets}
              prev={p.tickets}
              icon={Receipt}
              spark={data.daily.map((d) => d.tickets)}
              color={C.services}
            />
            <Kpi
              label="Panier moyen"
              value={money(s.avgTicket)}
              cur={s.avgTicket}
              prev={p.avgTicket}
              icon={ShoppingBasket}
              color={C.products}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Marge bénéficiaire" value={`${nf.format(Math.round(derived.margin * 10) / 10)}%`}>
              <Delta cur={derived.margin} prev={derived.prevMargin} />
            </MiniStat>
            <MiniStat label="Moyenne par jour" value={money(derived.avgDay)} />
            <MiniStat
              label="Meilleur jour"
              value={derived.best && derived.best.total > 0 ? money(derived.best.total) : "—"}
              hint={derived.best && derived.best.total > 0 ? dayLabel(derived.best.date) : undefined}
            />
            <MiniStat label="Articles vendus" value={nf.format(s.items)}>
              <Delta cur={s.items} prev={p.items} />
            </MiniStat>
          </div>

          {/* Daily money */}
          <Panel
            title="Recettes par jour"
            subtitle={`Du ${dayLabel(data.range.from)} au ${dayLabel(data.range.to)} — produits et services empilés, bénéfice en ligne`}
            legend={[
              { label: "Produits", color: C.products },
              { label: "Services", color: C.services },
              { label: "Bénéfice", color: C.profit },
            ]}
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={16} />
                  <YAxis tickFormatter={compact} {...axisProps} width={48} />
                  <Tooltip content={<ChartTooltip labelFormat={dayLabel} />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                  <Bar dataKey="products" name="Produits" stackId="a" fill={C.products} maxBarSize={28} />
                  <Bar dataKey="services" name="Services" stackId="a" fill={C.services} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Bénéfice"
                    stroke={C.profit}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-5">
            {/* Cumulative */}
            <Panel
              className="lg:col-span-3"
              title="Cumul du chiffre d'affaires"
              subtitle="Progression au fil des jours de la période"
            >
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={derived.cumulative} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumul" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.products} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={C.products} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} {...axisProps} minTickGap={16} />
                    <YAxis tickFormatter={compact} {...axisProps} width={48} />
                    <Tooltip content={<ChartTooltip labelFormat={dayLabel} />} />
                    <Area
                      type="monotone"
                      dataKey="cumul"
                      name="Cumul"
                      stroke={C.products}
                      strokeWidth={2}
                      fill="url(#cumul)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            {/* Products vs services */}
            <Panel className="lg:col-span-2" title="Répartition des recettes" subtitle="Produits vs services">
              <Donut
                total={s.revenue}
                centerLabel="Total DH"
                data={[
                  { name: "Produits", value: s.products, color: C.products },
                  { name: "Services", value: s.services, color: C.services },
                ]}
              />
            </Panel>
          </div>

          {/* 12-month growth */}
          <Panel
            title="Croissance sur 12 mois"
            subtitle="Chiffre d'affaires et bénéfice par mois"
            legend={[
              { label: "Chiffre d'affaires", color: C.products },
              { label: "Bénéfice", color: C.profit },
            ]}
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="month" tickFormatter={monthLabel} {...axisProps} />
                  <YAxis tickFormatter={compact} {...axisProps} width={48} />
                  <Tooltip content={<ChartTooltip labelFormat={monthLabel} />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                  <Bar dataKey="revenue" name="Chiffre d'affaires" fill={C.products} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Bénéfice"
                    stroke={C.profit}
                    strokeWidth={2}
                    dot={{ r: 3, fill: C.profit, strokeWidth: 0 }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          {/* Products */}
          <div className="grid gap-6 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title="Top 10 produits"
              subtitle={productMetric === "revenue" ? "Chiffre d'affaires et bénéfice" : "Quantités vendues"}
              legend={
                productMetric === "revenue"
                  ? [
                      { label: "Chiffre d'affaires", color: C.products },
                      { label: "Bénéfice", color: C.profit },
                    ]
                  : undefined
              }
            >
              <div className="mb-3 inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
                {(["revenue", "quantity"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setProductMetric(m)}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium",
                      productMetric === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                    )}
                  >
                    {m === "revenue" ? "Montant" : "Quantité"}
                  </button>
                ))}
              </div>
              {derived.topProducts.length ? (
                <div style={{ height: Math.max(220, derived.topProducts.length * 40) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={derived.topProducts}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      barGap={2}
                      barCategoryGap="25%"
                    >
                      <CartesianGrid horizontal={false} stroke={C.grid} />
                      <XAxis
                        type="number"
                        tickFormatter={productMetric === "revenue" ? compact : nf.format}
                        {...axisProps}
                      />
                      <YAxis type="category" dataKey="name" {...axisProps} width={110} tick={{ fill: "#52514e", fontSize: 12 }} />
                      <Tooltip
                        content={<ChartTooltip valueFormat={productMetric === "revenue" ? money : nf.format} />}
                        cursor={{ fill: "rgba(15,23,42,0.04)" }}
                      />
                      {productMetric === "revenue" ? (
                        <>
                          <Bar dataKey="revenue" name="Chiffre d'affaires" fill={C.products} radius={[0, 4, 4, 0]} maxBarSize={14} />
                          <Bar dataKey="profit" name="Bénéfice" fill={C.profit} radius={[0, 4, 4, 0]} maxBarSize={14} />
                        </>
                      ) : (
                        <Bar dataKey="quantity" name="Quantité" fill={C.products} radius={[0, 4, 4, 0]} maxBarSize={18} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty />
              )}
            </Panel>

            <Panel className="lg:col-span-2" title="Ventes par catégorie" subtitle="Chiffre d'affaires produits">
              <Donut
                total={data.categories.reduce((a, c) => a + c.revenue, 0)}
                centerLabel="Produits DH"
                data={foldOther(data.categories.map((c) => ({ name: c.name, value: c.revenue })), 6).map((c, i) => ({
                  ...c,
                  color: SERIES[i],
                }))}
              />
            </Panel>
          </div>

          {/* Products table */}
          <Panel
            title="Rentabilité des produits"
            subtitle="Coût = prix d'achat moyen des bons de réception (achats)"
          >
            {derived.missingCost > 0 && (
              <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {derived.missingCost} produit(s) sans prix d'achat enregistré : leur bénéfice est égal au chiffre
                d'affaires.
              </div>
            )}
            <ProductsTable rows={data.products} />
          </Panel>

          {/* Services */}
          <Panel
            title="Services"
            subtitle="Chiffre d'affaires et bénéfice (prix − frais)"
            legend={[
              { label: "Chiffre d'affaires", color: C.services },
              { label: "Bénéfice", color: C.profit },
            ]}
          >
            {data.services.length ? (
              <div style={{ height: Math.max(220, Math.min(data.services.length, 12) * 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.services.slice(0, 12)}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                    barGap={2}
                    barCategoryGap="25%"
                  >
                    <CartesianGrid horizontal={false} stroke={C.grid} />
                    <XAxis type="number" tickFormatter={compact} {...axisProps} />
                    <YAxis type="category" dataKey="name" {...axisProps} width={130} tick={{ fill: "#52514e", fontSize: 12 }} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                    <Bar dataKey="revenue" name="Chiffre d'affaires" fill={C.services} radius={[0, 4, 4, 0]} maxBarSize={14} />
                    <Bar dataKey="profit" name="Bénéfice" fill={C.profit} radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty />
            )}
          </Panel>

          {/* Activity patterns */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Heures d'affluence" subtitle="Chiffre d'affaires par heure de la journée">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={derived.hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="15%">
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} {...axisProps} interval={1} />
                    <YAxis tickFormatter={compact} {...axisProps} width={44} />
                    <Tooltip
                      content={<ChartTooltip labelFormat={(h) => `${h}h – ${Number(h) + 1}h`} />}
                      cursor={{ fill: "rgba(15,23,42,0.04)" }}
                    />
                    <Bar dataKey="revenue" name="Chiffre d'affaires" radius={[4, 4, 0, 0]}>
                      {derived.hours.map((h) => (
                        <Cell key={h.hour} fill={heat(h.revenue, Math.max(...derived.hours.map((x) => x.revenue)))} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Jours de la semaine" subtitle="Chiffre d'affaires cumulé par jour">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekdays} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="day" {...axisProps} />
                    <YAxis tickFormatter={compact} {...axisProps} width={44} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(15,23,42,0.04)" }} />
                    <Bar dataKey="revenue" name="Chiffre d'affaires" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {data.weekdays.map((w) => (
                        <Cell key={w.day} fill={heat(w.revenue, Math.max(...data.weekdays.map((x) => x.revenue)))} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          {/* Locals / payments / cashiers */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Modes de paiement" subtitle="Montant encaissé par mode">
              <Donut
                total={s.revenue}
                centerLabel="Total DH"
                data={data.payments.methods.map((m) => ({
                  name: `${PAYMENT_LABEL[m.method]} (${m.count})`,
                  value: m.total,
                  color: PAYMENT_COLORS[m.method],
                }))}
              />
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-slate-500">Total espèces</div>
                  <div className="mt-0.5 font-semibold text-slate-900">{money(data.payments.cash)}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5">
                  <div className="text-slate-500">Total TPE</div>
                  <div className="mt-0.5 font-semibold text-slate-900">{money(data.payments.tpe)}</div>
                </div>
              </div>
            </Panel>

            <Panel title="Par local" subtitle="Chiffre d'affaires par point de vente">
              <RankList rows={data.locals.map((l) => ({ name: l.name, value: l.revenue, sub: `${l.tickets} tickets` }))} color={C.products} />
            </Panel>

            <Panel title="Par caissier" subtitle="Chiffre d'affaires encaissé">
              <RankList rows={data.users.map((u) => ({ name: u.name, value: u.revenue, sub: `${u.tickets} tickets` }))} color={C.services} />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
        {hint && <div className="text-xs capitalize text-slate-400">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function RankList({ rows, color }: { rows: { name: string; value: number; sub?: string }[]; color: string }) {
  if (!rows.length) return <Empty h={200} />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3.5">
      {rows.slice(0, 8).map((r) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-medium text-slate-700">{r.name}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{money(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          {r.sub && <div className="mt-0.5 text-xs text-slate-400">{r.sub}</div>}
        </li>
      ))}
    </ul>
  );
}

function ProductsTable({ rows }: { rows: Dashboard["products"] }) {
  const [sort, setSort] = useState<"revenue" | "profit" | "quantity" | "margin">("revenue");
  if (!rows.length) return <Empty h={120} />;
  const margin = (r: Dashboard["products"][number]) => (r.revenue ? (r.profit / r.revenue) * 100 : 0);
  const sorted = [...rows].sort((a, b) => (sort === "margin" ? margin(b) - margin(a) : b[sort] - a[sort]));
  const th = (key: typeof sort, label: string) => (
    <th className="px-3 py-2 text-right">
      <button
        onClick={() => setSort(key)}
        className={cn("font-medium", sort === key ? "text-slate-900" : "text-slate-500 hover:text-slate-700")}
      >
        {label}
        {sort === key && " ↓"}
      </button>
    </th>
  );
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-100">
      <table className="mobile-cards w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 text-xs">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-500">Produit</th>
            <th className="hidden px-3 py-2 text-left font-medium text-slate-500 md:table-cell">Catégorie</th>
            {th("quantity", "Qté")}
            {th("revenue", "CA")}
            <th className="hidden px-3 py-2 text-right font-medium text-slate-500 md:table-cell">Coût</th>
            {th("profit", "Bénéfice")}
            {th("margin", "Marge")}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {sorted.map((r) => {
            const m = margin(r);
            return (
              <tr key={r.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 font-medium text-slate-800">
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="size-3.5 text-slate-400" />
                    {r.name}
                    {!r.costKnown && <AlertTriangle className="size-3.5 text-amber-500" aria-label="Prix d'achat inconnu" />}
                  </span>
                </td>
                <td className="hidden px-3 py-2 text-slate-500 md:table-cell">{r.category}</td>
                <td className="px-3 py-2 text-right text-slate-700">{nf.format(r.quantity)}</td>
                <td className="px-3 py-2 text-right text-slate-900">{money(r.revenue)}</td>
                <td className="hidden px-3 py-2 text-right text-slate-500 md:table-cell">
                  {r.costKnown ? money(r.cost) : "—"}
                </td>
                <td className={cn("px-3 py-2 text-right font-medium", r.profit < 0 ? "text-red-600" : "text-slate-900")}>
                  {money(r.profit)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-2">
                    <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-slate-100 sm:inline-block">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, m))}%`, background: C.profit }}
                      />
                    </span>
                    <span className="w-10 text-slate-700">{Math.round(m)}%</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Keep the first n entries, fold the rest into "Autres" */
function foldOther(rows: { name: string; value: number }[], n: number) {
  if (rows.length <= n) return rows;
  const rest = rows.slice(n - 1).reduce((a, r) => a + r.value, 0);
  return [...rows.slice(0, n - 1), { name: "Autres", value: rest }];
}

/** One-hue sequential blue ramp (light → dark) by magnitude */
function heat(v: number, max: number) {
  const ramp = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf", "#1c5cab"];
  if (!max || v <= 0) return "#e1e0d9";
  return ramp[Math.min(ramp.length - 1, Math.floor((v / max) * (ramp.length - 0.001)))];
}
