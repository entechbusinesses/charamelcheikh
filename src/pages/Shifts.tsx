import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useReactToPrint } from "react-to-print";
import {
  Banknote,
  ClockIcon,
  CreditCard,
  Loader2,
  LockIcon,
  PrinterIcon,
  ReceiptText,
  WalletIcon,
} from "lucide-react";
import api from "@/apis/api";
import Title from "@/components/ui/Title";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import ShiftTicket from "@/components/shift/ShiftTicket";
import {
  apiErrorMessage,
  formatDH,
  formatDuration,
} from "@/components/shift/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useShift, type Shift } from "@/contexts/ShiftContext";
import { cn } from "@/lib/utils";

interface Local {
  id: number;
  name: string;
  type: string;
}

interface UserOption {
  id: number;
  name: string;
}

const LOCAL_TYPES = ["BELDI", "TURKI", "DEPOT"];

const STATUS_LABELS: Record<string, string> = {
  tous: "Tous statuts",
  OPEN: "En cours",
  CLOSED: "Clôturés",
};

const today = () => format(new Date(), "yyyy-MM-dd");
const dateTime = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm");

const selectClass =
  "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export default function Shifts() {
  const { user } = useAuth();
  const { refresh: refreshCurrentShift } = useShift();
  const isAdmin = user?.role === "ADMIN";

  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [userFilter, setUserFilter] = useState("tous");
  const [localFilter, setLocalFilter] = useState("tous");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [statusFilter, setStatusFilter] = useState("tous");

  const [users, setUsers] = useState<UserOption[]>([]);
  const [locals, setLocals] = useState<Local[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // printing: one shift ticket, or the whole filtered list
  const [ticketShift, setTicketShift] = useState<Shift | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const printTicket = useReactToPrint({ contentRef: ticketRef });
  const printReport = useReactToPrint({
    contentRef: reportRef,
    documentTitle: `shifts_${from}_${to}`,
  });

  useEffect(() => {
    // the ticket is rendered first, then printed
    if (ticketShift) printTicket();
  }, [ticketShift]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, localsRes] = await Promise.all([
          isAdmin ? api.get("/auth/list") : Promise.resolve({ data: [] }),
          api.get("/locals/list"),
        ]);
        setUsers(usersRes.data);
        setLocals(localsRes.data.data);
      } catch (err) {
        console.error("Error fetching filters:", err);
      }
    };
    fetchOptions();
  }, [isAdmin]);

  const fetchShifts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await api.get("/shifts/list", {
        params: {
          from,
          to,
          user_id: userFilter,
          local_id: localFilter,
          type: typeFilter,
          status: statusFilter,
        },
      });
      setShifts(response.data.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching shifts:", err);
      setError(apiErrorMessage(err, "Échec du chargement des shifts."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [from, to, userFilter, localFilter, typeFilter, statusFilter]);

  const handleClose = async (shift: Shift) => {
    if (
      !window.confirm(
        `Clôturer le shift #${shift.id} de ${shift.user.name} ? Ses ventes seront arrêtées.`,
      )
    )
      return;
    try {
      setBusy(shift.id);
      const response = await api.post("/shifts/close", { id: shift.id });
      await fetchShifts(true);
      refreshCurrentShift();
      if (window.confirm("Shift clôturé. Imprimer le ticket de clôture ?")) {
        setTicketShift(response.data.data);
      }
    } catch (err) {
      alert(apiErrorMessage(err, "Impossible de clôturer ce shift."));
    } finally {
      setBusy(null);
    }
  };

  const totals = shifts.reduce(
    (acc, s) => ({
      count: acc.count + s.summary.count,
      fond: acc.fond + s.fond_caisse,
      cash: acc.cash + s.summary.cash,
      tpe: acc.tpe + s.summary.tpe,
      total: acc.total + s.summary.total,
    }),
    { count: 0, fond: 0, cash: 0, tpe: 0, total: 0 },
  );

  const filterLabels = {
    period: `Du ${format(new Date(`${from}T00:00:00`), "dd/MM/yyyy")} au ${format(new Date(`${to}T00:00:00`), "dd/MM/yyyy")}`,
    user: isAdmin
      ? userFilter === "tous"
        ? "Tous les caissiers"
        : users.find((u) => u.id.toString() === userFilter)?.name || "-"
      : user?.name || "-",
    local:
      localFilter === "tous"
        ? "Tous les locaux"
        : locals.find((l) => l.id.toString() === localFilter)?.name || "-",
    type: typeFilter === "tous" ? "Tous types" : typeFilter,
    status: STATUS_LABELS[statusFilter],
  };

  const cards = [
    {
      title: "Shifts",
      value: String(shifts.length),
      detail: `${totals.count} vente(s)`,
      icon: ClockIcon,
      style: "border-slate-200 bg-slate-50 text-slate-700",
    },
    {
      title: "Fonds de caisse",
      value: formatDH(totals.fond),
      detail: "Total des fonds de départ",
      icon: WalletIcon,
      style: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      title: "Espèces",
      value: formatDH(totals.cash),
      detail: "Ventes encaissées en espèces",
      icon: Banknote,
      style: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      title: "TPE",
      value: formatDH(totals.tpe),
      detail: "Ventes encaissées par carte",
      icon: CreditCard,
      style: "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      title: "Total ventes",
      value: formatDH(totals.total),
      detail: `Caisse attendue : ${formatDH(totals.fond + totals.cash)}`,
      icon: ReceiptText,
      style: "border-violet-200 bg-violet-50 text-violet-700",
    },
  ];

  return (
    <div className="px-6 space-y-5">
      <Title
        Icon={ClockIcon}
        title="Gestion des shifts"
        description="Historique des shifts, fonds de caisse et encaissements"
        btnText="Imprimer la liste"
        btnIcon={PrinterIcon}
        onClick={() => printReport()}
        add
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <label className="flex items-center gap-2">
          De:
          <input
            type="date"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
            className={selectClass}
          />
        </label>
        <label className="flex items-center gap-2">
          à:
          <input
            type="date"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
            className={selectClass}
          />
        </label>
        {isAdmin && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className={selectClass}
          >
            <option value="tous">Tous Caissiers</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={localFilter}
          onChange={(e) => setLocalFilter(e.target.value)}
          className={selectClass}
        >
          <option value="tous">Tous Locaux</option>
          {locals.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} | {l.type}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={selectClass}
        >
          <option value="tous">Tous Types</option>
          {LOCAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {cards.map((card) => (
          <section
            key={card.title}
            className={cn("flex items-center gap-4 rounded-lg border p-4", card.style)}
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/70">
              <card.icon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="truncate text-xs opacity-80">{card.detail}</p>
            </div>
          </section>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinning />
        ) : error ? (
          <p className="p-6 text-center text-red-600">{error}</p>
        ) : shifts.length === 0 ? (
          <p className="p-10 text-center text-gray-500">
            Aucun shift pour ces filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "# ID",
                    "Caissier",
                    "Local",
                    "Statut",
                    "Ouverture",
                    "Clôture",
                    "Durée",
                    "Fond de caisse",
                    "Ventes",
                    "Espèces",
                    "TPE",
                    "Total",
                    "Caisse",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      #{shift.id}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.user.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.local.name} | {shift.local.type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge open={!shift.closed_at} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dateTime(shift.opened_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.closed_at ? dateTime(shift.closed_at) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDuration(
                        shift.opened_at,
                        shift.closed_at ?? new Date().toISOString(),
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDH(shift.fond_caisse)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.summary.count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDH(shift.summary.cash)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDH(shift.summary.tpe)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {formatDH(shift.summary.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">
                      {formatDH(shift.balance)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTicketShift({ ...shift })}
                          title="Imprimer le ticket"
                          className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1.5 text-blue-700 hover:bg-blue-200"
                        >
                          <PrinterIcon className="size-4" />
                          Imprimer
                        </button>
                        {isAdmin && !shift.closed_at && (
                          <button
                            onClick={() => handleClose(shift)}
                            disabled={busy === shift.id}
                            title="Clôturer le shift"
                            className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1.5 text-red-600 hover:bg-red-200 disabled:opacity-60"
                          >
                            {busy === shift.id ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <LockIcon className="size-4" />
                            )}
                            Clôturer
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable content */}
      <div className="print:block hidden" ref={ticketRef}>
        {ticketShift && <ShiftTicket shift={ticketShift} />}
      </div>
      <div className="print:block hidden" ref={reportRef}>
        <ShiftsReport shifts={shifts} totals={totals} filters={filterLabels} />
      </div>
    </div>
  );
}

function StatusBadge({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        open ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
      )}
    >
      {open ? "En cours" : "Clôturé"}
    </span>
  );
}

/** A4 report of the filtered shifts */
function ShiftsReport({
  shifts,
  totals,
  filters,
}: {
  shifts: Shift[];
  totals: { count: number; fond: number; cash: number; tpe: number; total: number };
  filters: Record<"period" | "user" | "local" | "type" | "status", string>;
}) {
  const cell = "border border-black px-1.5 py-1";

  return (
    <div className="bg-white p-6 text-[11px] text-black">
      <style>{"@page { size: A4 landscape; margin: 10mm; }"}</style>
      <h1 className="text-xl font-bold">Rapport des shifts</h1>
      <p className="mb-3">
        {filters.period} · {filters.user} · {filters.local} · {filters.type} ·{" "}
        {filters.status} — imprimé le{" "}
        {format(new Date(), "P à p", { locale: fr })}
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            {[
              "#",
              "Caissier",
              "Local",
              "Statut",
              "Ouverture",
              "Clôture",
              "Durée",
              "Fond",
              "Ventes",
              "Services",
              "Produits",
              "Frais",
              "Espèces",
              "TPE",
              "Total",
              "Caisse",
            ].map((h) => (
              <th key={h} className={cn(cell, "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shifts.map((s) => (
            <tr key={s.id}>
              <td className={cell}>{s.id}</td>
              <td className={cell}>{s.user.name}</td>
              <td className={cell}>
                {s.local.name} ({s.local.type})
              </td>
              <td className={cell}>{s.closed_at ? "Clôturé" : "En cours"}</td>
              <td className={cell}>{dateTime(s.opened_at)}</td>
              <td className={cell}>{s.closed_at ? dateTime(s.closed_at) : "—"}</td>
              <td className={cell}>
                {formatDuration(s.opened_at, s.closed_at ?? new Date().toISOString())}
              </td>
              <td className={cell}>{s.fond_caisse.toFixed(2)}</td>
              <td className={cell}>{s.summary.count}</td>
              <td className={cell}>{s.summary.services.toFixed(2)}</td>
              <td className={cell}>{s.summary.products.toFixed(2)}</td>
              <td className={cell}>{s.summary.frais.toFixed(2)}</td>
              <td className={cell}>{s.summary.cash.toFixed(2)}</td>
              <td className={cell}>{s.summary.tpe.toFixed(2)}</td>
              <td className={cell}>{s.summary.total.toFixed(2)}</td>
              <td className={cn(cell, "font-bold")}>{s.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td className={cell} colSpan={7}>
              Total ({shifts.length} shift{shifts.length > 1 ? "s" : ""})
            </td>
            <td className={cell}>{totals.fond.toFixed(2)}</td>
            <td className={cell}>{totals.count}</td>
            <td className={cell}>
              {shifts.reduce((a, s) => a + s.summary.services, 0).toFixed(2)}
            </td>
            <td className={cell}>
              {shifts.reduce((a, s) => a + s.summary.products, 0).toFixed(2)}
            </td>
            <td className={cell}>
              {shifts.reduce((a, s) => a + s.summary.frais, 0).toFixed(2)}
            </td>
            <td className={cell}>{totals.cash.toFixed(2)}</td>
            <td className={cell}>{totals.tpe.toFixed(2)}</td>
            <td className={cell}>{totals.total.toFixed(2)}</td>
            <td className={cell}>{(totals.fond + totals.cash).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2">Montants en DH. Caisse = fond de caisse + espèces.</p>
    </div>
  );
}
