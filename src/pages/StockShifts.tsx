import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import {
  Boxes,
  CheckCircle2,
  Loader2,
  LockIcon,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import api from "@/apis/api";
import Title from "@/components/ui/Title";
import Modal from "@/components/ui/Modal";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { apiErrorMessage, formatDH } from "@/components/shift/utils";
import { cn } from "@/lib/utils";

interface Local {
  id: number;
  name: string;
  type: string;
}

type ResultStatus = "OK" | "MANQUE" | "EXCEDENT";

interface Movements {
  receptions_in: number;
  receptions_out: number;
  sales_products: number;
}

interface StockResult {
  expected_sales: number;
  difference: number;
  status: ResultStatus;
}

interface StockShift extends Movements, StockResult {
  id: number;
  local_id: number;
  local: Local;
  user: { id: number; name: string };
  started_at: string;
  ended_at: string | null;
  initial_value: number;
  final_value: number;
  note: string | null;
  // open shift: movements computed up to now
  live: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  tous: "Tous statuts",
  OPEN: "En cours",
  CLOSED: "Clôturés",
};

const dateTime = (d: string) => format(new Date(d), "dd/MM/yyyy HH:mm");
const inputNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Same formula as the server: (initial + reçus - sortis) - final = ventes attendues */
const computeResult = (
  initial: number,
  final: number,
  m: Movements,
): StockResult => {
  const expected_sales = round2(
    initial + m.receptions_in - m.receptions_out - final,
  );
  const difference = round2(m.sales_products - expected_sales);
  return {
    expected_sales,
    difference,
    status: difference === 0 ? "OK" : difference < 0 ? "MANQUE" : "EXCEDENT",
  };
};

const selectClass =
  "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500";
const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-main";

export default function StockShifts() {
  const [locals, setLocals] = useState<Local[]>([]);
  const [localFilter, setLocalFilter] = useState("tous");
  const [statusFilter, setStatusFilter] = useState("tous");
  const [shifts, setShifts] = useState<StockShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showStart, setShowStart] = useState(false);
  const [closing, setClosing] = useState<StockShift | null>(null);

  useEffect(() => {
    api
      .get("/locals/list")
      .then((res) =>
        setLocals(
          (res.data.data as Local[]).filter((l) => l.type === "BELDI"),
        ),
      )
      .catch((err) => console.error("Error fetching locals:", err));
  }, []);

  const fetchShifts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get("/stock-shifts/list", {
        params: { local_id: localFilter, status: statusFilter },
      });
      setShifts(res.data.data);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Échec du chargement des shifts de stock."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShifts();
  }, [localFilter, statusFilter]);

  const handleDelete = async (shift: StockShift) => {
    if (
      !window.confirm(
        `Supprimer le shift de stock #${shift.id} (${shift.local.name}) ?`,
      )
    )
      return;
    try {
      await api.delete(`/stock-shifts/${shift.id}`);
      fetchShifts(true);
    } catch (err) {
      alert(apiErrorMessage(err, "Impossible de supprimer ce shift."));
    }
  };

  return (
    <div className="px-6 space-y-5">
      <Title
        Icon={Boxes}
        title="Shift stock Beldi"
        description="(Stock initial + bons de réception) - stock final = ventes produits"
        btnText="Démarrer un shift"
        btnIcon={Plus}
        onClick={() => setShowStart(true)}
        add
      />

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <select
          value={localFilter}
          onChange={(e) => setLocalFilter(e.target.value)}
          className={selectClass}
        >
          <option value="tous">Tous les locaux BELDI</option>
          {locals.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <LoadingSpinning />
        ) : error ? (
          <p className="p-6 text-center text-red-600">{error}</p>
        ) : shifts.length === 0 ? (
          <p className="p-10 text-center text-gray-500">
            Aucun shift de stock pour ces filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "# ID",
                    "Local",
                    "Statut",
                    "Début",
                    "Fin",
                    "Stock initial",
                    "Bons reçus",
                    "Bons sortis",
                    "Stock final",
                    "Ventes attendues",
                    "Ventes produits",
                    "Écart",
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
                      {shift.local.name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium",
                          shift.ended_at
                            ? "bg-gray-100 text-gray-600"
                            : "bg-green-100 text-green-700",
                        )}
                      >
                        {shift.ended_at ? "Clôturé" : "En cours"}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {dateTime(shift.started_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.ended_at ? dateTime(shift.ended_at) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDH(shift.initial_value)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-emerald-700">
                      + {formatDH(shift.receptions_in)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-orange-700">
                      - {formatDH(shift.receptions_out)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.ended_at ? formatDH(shift.final_value) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.ended_at ? formatDH(shift.expected_sales) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {formatDH(shift.sales_products)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {shift.ended_at ? (
                        <ResultBadge
                          status={shift.status}
                          difference={shift.difference}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-2">
                        {!shift.ended_at && (
                          <button
                            onClick={() => setClosing(shift)}
                            className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1.5 text-red-600 hover:bg-red-200"
                          >
                            <LockIcon className="size-4" />
                            Clôturer
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(shift)}
                          title="Supprimer"
                          className="flex items-center rounded-md bg-gray-100 px-2 py-1.5 text-gray-600 hover:bg-gray-200"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StartModal
        open={showStart}
        locals={locals}
        shifts={shifts}
        onClose={() => setShowStart(false)}
        onDone={() => {
          setShowStart(false);
          fetchShifts(true);
        }}
      />
      {closing && (
        <CloseModal
          shift={closing}
          onClose={() => setClosing(null)}
          onDone={() => fetchShifts(true)}
        />
      )}
    </div>
  );
}

function ResultBadge({
  status,
  difference,
}: {
  status: ResultStatus;
  difference: number;
}) {
  const styles: Record<ResultStatus, string> = {
    OK: "bg-green-100 text-green-700",
    MANQUE: "bg-red-100 text-red-700",
    EXCEDENT: "bg-amber-100 text-amber-700",
  };
  const labels: Record<ResultStatus, string> = {
    OK: "Équilibré",
    MANQUE: "Manque",
    EXCEDENT: "Excédent",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        styles[status],
      )}
    >
      {labels[status]}
      {status !== "OK" &&
        ` ${difference > 0 ? "+" : ""}${formatDH(difference)}`}
    </span>
  );
}

function StartModal({
  open,
  locals,
  shifts,
  onClose,
  onDone,
}: {
  open: boolean;
  locals: Local[];
  shifts: StockShift[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [localId, setLocalId] = useState("");
  const [startedAt, setStartedAt] = useState(inputNow());
  const [initial, setInitial] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalId(locals.length === 1 ? String(locals[0].id) : "");
    setStartedAt(inputNow());
    setInitial("");
    setNote("");
    setError(null);
  }, [open]);

  // the previous closed shift of this local: its end and final stock carry over
  const previous = shifts.find(
    (s) => s.ended_at && String(s.local_id) === localId,
  );

  useEffect(() => {
    if (!previous) return;
    setInitial(String(previous.final_value));
    setStartedAt(format(new Date(previous.ended_at!), "yyyy-MM-dd'T'HH:mm"));
  }, [previous?.id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!localId) return setError("Veuillez choisir un local.");
    try {
      setSaving(true);
      await api.post("/stock-shifts/start", {
        local_id: localId,
        started_at: new Date(startedAt).toISOString(),
        initial_value: initial,
        note,
      });
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de démarrer le shift."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={saving}
      size="sm"
      title="Démarrer un shift de stock"
      description="Valeur du stock compté au début de la période"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Local BELDI
          <select
            value={localId}
            onChange={(e) => setLocalId(e.target.value)}
            className={inputClass}
          >
            <option value="">Choisir…</option>
            {locals.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date de début
          <input
            type="datetime-local"
            required
            value={startedAt}
            onChange={(e) => setStartedAt(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Valeur du stock initial (DH)
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={initial}
            onChange={(e) => setInitial(e.target.value)}
            placeholder="0"
            className={inputClass}
          />
          {previous && (
            <span className="text-xs font-normal text-gray-500">
              Repris du stock final du shift #{previous.id}
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Note (optionnel)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full bg-main hover:bg-main-dark text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          Démarrer le shift
        </button>
      </form>
    </Modal>
  );
}

function CloseModal({
  shift,
  onClose,
  onDone,
}: {
  shift: StockShift;
  onClose: () => void;
  onDone: () => void;
}) {
  const [endedAt, setEndedAt] = useState(inputNow());
  const [finalValue, setFinalValue] = useState("");
  const [movements, setMovements] = useState<Movements | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closed, setClosed] = useState<StockShift | null>(null);
  const [error, setError] = useState<string | null>(null);

  // bons de réception and sales up to the chosen end date
  useEffect(() => {
    if (!endedAt) return;
    let cancelled = false;
    setLoadingPreview(true);
    api
      .get(`/stock-shifts/${shift.id}/preview`, {
        params: { ended_at: new Date(endedAt).toISOString() },
      })
      .then((res) => {
        if (!cancelled) {
          setMovements(res.data.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(apiErrorMessage(err, "Calcul impossible."));
      })
      .finally(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [endedAt, shift.id]);

  const final = Number(finalValue);
  const hasFinal = finalValue !== "" && Number.isFinite(final) && final >= 0;
  const result =
    closed ??
    (movements && hasFinal
      ? computeResult(shift.initial_value, final, movements)
      : null);
  const shown = closed ?? movements;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hasFinal) return setError("Valeur du stock final invalide.");
    if (!window.confirm("Clôturer ce shift de stock ?")) return;
    try {
      setSaving(true);
      const res = await api.post(`/stock-shifts/${shift.id}/close`, {
        ended_at: new Date(endedAt).toISOString(),
        final_value: finalValue,
      });
      setClosed(res.data.data);
      onDone();
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de clôturer ce shift."));
    } finally {
      setSaving(false);
    }
  };

  const row = (label: string, value: string, className = "") => (
    <div className={cn("flex justify-between gap-4 py-1.5", className)}>
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={saving}
      size="sm"
      title={`Clôturer le shift de stock #${shift.id}`}
      description={`${shift.local.name} · depuis le ${dateTime(shift.started_at)}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!closed && (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Date de fin
              <input
                type="datetime-local"
                required
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Valeur du stock actuel en caisse (DH)
              <input
                type="number"
                min={0}
                step="0.01"
                required
                autoFocus
                value={finalValue}
                onChange={(e) => setFinalValue(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </label>
          </>
        )}

        <div className="rounded-lg border bg-gray-50 px-4 py-2 text-sm divide-y">
          {row("Stock initial", formatDH(shift.initial_value))}
          {row(
            "+ Bons de réception reçus",
            shown ? formatDH(shown.receptions_in) : "…",
            "text-emerald-700",
          )}
          {row(
            "- Bons sortis (transferts)",
            shown ? formatDH(shown.receptions_out) : "…",
            "text-orange-700",
          )}
          {row(
            "- Stock final",
            closed ? formatDH(closed.final_value) : hasFinal ? formatDH(final) : "…",
          )}
          {row(
            "= Ventes attendues",
            result ? formatDH(result.expected_sales) : "…",
            "font-semibold",
          )}
          {row(
            "Ventes produits (POS)",
            shown ? formatDH(shown.sales_products) : "…",
            "font-semibold",
          )}
          {loadingPreview && !closed && (
            <p className="flex items-center gap-2 py-1.5 text-gray-500">
              <Loader2 className="size-4 animate-spin" /> Calcul…
            </p>
          )}
        </div>

        {result && <ResultPanel result={result} />}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {closed ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-main hover:bg-main-dark text-white py-3 rounded-lg font-medium"
          >
            Fermer
          </button>
        ) : (
          <button
            type="submit"
            disabled={saving || !movements}
            className="flex items-center justify-center gap-2 w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LockIcon className="size-4" />
            )}
            Clôturer le shift
          </button>
        )}
      </form>
    </Modal>
  );
}

function ResultPanel({ result }: { result: StockResult }) {
  const config = {
    OK: {
      icon: CheckCircle2,
      title: "Équilibré",
      text: "Les ventes correspondent exactement au stock sorti.",
      style: "border-green-200 bg-green-50 text-green-700",
    },
    MANQUE: {
      icon: TrendingDown,
      title: `Manque de ${formatDH(Math.abs(result.difference))}`,
      text: "Le stock sorti est supérieur aux ventes enregistrées.",
      style: "border-red-200 bg-red-50 text-red-700",
    },
    EXCEDENT: {
      icon: TrendingUp,
      title: `Excédent de ${formatDH(result.difference)}`,
      text: "Les ventes enregistrées dépassent le stock sorti.",
      style: "border-amber-200 bg-amber-50 text-amber-700",
    },
  }[result.status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4",
        config.style,
      )}
    >
      <config.icon className="size-8 shrink-0" />
      <div>
        <p className="font-bold">{config.title}</p>
        <p className="text-sm opacity-80">{config.text}</p>
      </div>
    </div>
  );
}
