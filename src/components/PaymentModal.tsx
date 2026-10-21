import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  CreditCard,
  ArrowLeftRight,
  Delete,
  ArrowLeft,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

export type PaymentMethod = "CASH" | "TPE" | "MIXTE";

export interface Payment {
  method: PaymentMethod;
  cash: number;
  tpe: number;
}

interface PaymentModalProps {
  open: boolean;
  total: number;
  onClose: () => void;
  /** Saves the order; throw to show an error in the modal */
  onConfirm: (payment: Payment) => Promise<void>;
}

const LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  TPE: "TPE (Carte)",
  MIXTE: "Mixte",
};

interface MixState {
  cash: string;
  tpe: string;
  active: "cash" | "tpe";
  /** right after selecting a field, the first key replaces its value */
  fresh: boolean;
}

const EMPTY_MIX: MixState = { cash: "", tpe: "", active: "cash", fresh: true };

const ARM_TIMEOUT = 3000; // ms to give the second click
const SUCCESS_DELAY = 1700; // ms the success animation stays on screen

const round2 = (n: number) => Math.round(n * 100) / 100;
const toNumber = (s: string) => (s === "" || s === "." ? 0 : parseFloat(s));
const formatInput = (n: number) =>
  n <= 0 ? "" : String(round2(n)).replace(/\.0+$/, "");

export default function PaymentModal({
  open,
  total,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const [view, setView] = useState<"choose" | "mixte">("choose");
  const [armed, setArmed] = useState<"CASH" | "TPE" | null>(null);
  const [submitting, setSubmitting] = useState<PaymentMethod | null>(null);
  const [done, setDone] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mixed payment. Kept in one object mirrored in a ref so fast key
  // presses always build on the latest value (no stale closures).
  const [mix, setMix] = useState<MixState>(EMPTY_MIX);
  const mixRef = useRef<MixState>(EMPTY_MIX);
  const updateMix = (next: MixState) => {
    mixRef.current = next;
    setMix(next);
  };
  const { cash, tpe, active } = mix;

  const selectField = (field: "cash" | "tpe") =>
    updateMix({ ...mixRef.current, active: field, fresh: true });

  const armTimer = useRef<number>();
  const submittingRef = useRef(false);

  // Reset everything each time the modal opens
  useEffect(() => {
    if (!open) return;
    setView("choose");
    setArmed(null);
    setSubmitting(null);
    setDone(null);
    setError(null);
    updateMix(EMPTY_MIX);
    submittingRef.current = false;
  }, [open]);

  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const busy = submitting !== null || done !== null;

  const confirm = async (payment: Payment) => {
    if (busy || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setSubmitting(payment.method);
    try {
      await onConfirm(payment);
      setDone(payment);
      window.setTimeout(onClose, SUCCESS_DELAY);
    } catch {
      submittingRef.current = false;
      setError("Échec de l'enregistrement de la commande. Réessayez.");
    } finally {
      setSubmitting(null);
      setArmed(null);
    }
  };

  // Cash / TPE need two clicks: first arms, second confirms
  const handleQuickPay = (method: "CASH" | "TPE") => {
    if (busy) return;
    window.clearTimeout(armTimer.current);
    if (armed === method) {
      confirm({
        method,
        cash: method === "CASH" ? total : 0,
        tpe: method === "TPE" ? total : 0,
      });
      return;
    }
    setArmed(method);
    armTimer.current = window.setTimeout(() => setArmed(null), ARM_TIMEOUT);
  };

  // ---------- Mixed payment ----------
  const cashN = toNumber(cash);
  const tpeN = toNumber(tpe);
  const paid = round2(cashN + tpeN);
  const remaining = round2(total - paid);
  const mixteValid =
    cashN > 0 && tpeN > 0 && Math.abs(remaining) < 0.005;

  const setActiveValue = (value: string) => {
    const m = mixRef.current;
    // the other field gets what is left to pay
    const other = formatInput(round2(total - toNumber(value)));
    updateMix(
      m.active === "cash"
        ? { ...m, cash: value, tpe: other, fresh: false }
        : { ...m, tpe: value, cash: other, fresh: false }
    );
  };

  const pressKey = (key: string) => {
    const m = mixRef.current;
    const startFresh = m.fresh && key !== "⌫";
    const current = startFresh ? "" : m.active === "cash" ? m.cash : m.tpe;
    if (key === "C") return setActiveValue("");
    if (key === "⌫") return setActiveValue(current.slice(0, -1));
    if (key === ".") {
      if (current.includes(".")) return;
      return setActiveValue(current === "" ? "0." : current + ".");
    }
    // max 2 decimals
    const [, dec] = current.split(".");
    if (dec !== undefined && dec.length >= 2) return;
    if (current === "0") return setActiveValue(key);
    setActiveValue(current + key);
  };

  const confirmMixte = () => {
    const m = mixRef.current;
    const c = toNumber(m.cash);
    const t = toNumber(m.tpe);
    if (c > 0 && t > 0 && Math.abs(round2(total - c - t)) < 0.005) {
      confirm({ method: "MIXTE", cash: c, tpe: t });
    }
  };

  // Physical keyboard support for the mixed view
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) pressKey(e.key);
    else if (e.key === "." || e.key === ",") pressKey(".");
    else if (e.key === "Backspace") pressKey("⌫");
    else if (e.key === "Delete") pressKey("C");
    else if (e.key === "Tab")
      selectField(mixRef.current.active === "cash" ? "tpe" : "cash");
    else if (e.key === "Enter") confirmMixte();
    else return;
    e.preventDefault();
  };
  useEffect(() => {
    if (!open || view !== "mixte" || busy) return;
    const onKey = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, view, busy]);

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      closeDisabled={busy}
      size="lg"
      title={done ? "Paiement confirmé" : "Mode de paiement"}
      description={
        done ? undefined : (
          <>
            Total à payer :{" "}
            <span className="font-bold text-gray-900">
              {total.toFixed(2)} DH
            </span>
          </>
        )
      }
    >
      {done ? (
        <SuccessView payment={done} />
      ) : view === "choose" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <MethodCard
              icon={Banknote}
              label={LABELS.CASH}
              hint="Double-clic pour confirmer"
              color="emerald"
              armed={armed === "CASH"}
              loading={submitting === "CASH"}
              disabled={busy}
              onClick={() => handleQuickPay("CASH")}
            />
            <MethodCard
              icon={CreditCard}
              label={LABELS.TPE}
              hint="Double-clic pour confirmer"
              color="blue"
              armed={armed === "TPE"}
              loading={submitting === "TPE"}
              disabled={busy}
              onClick={() => handleQuickPay("TPE")}
            />
            <MethodCard
              icon={ArrowLeftRight}
              label={LABELS.MIXTE}
              hint="Espèces + TPE"
              color="violet"
              disabled={busy}
              onClick={() => {
                setArmed(null);
                selectField("cash");
                setView("mixte");
              }}
            />
          </div>
          {error && <ErrorBox message={error} />}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left: amounts */}
          <div className="flex flex-col gap-4">
            <AmountField
              icon={Banknote}
              label="Espèces"
              color="emerald"
              value={cash}
              active={active === "cash"}
              onSelect={() => selectField("cash")}
            />
            <AmountField
              icon={CreditCard}
              label="TPE (Carte)"
              color="blue"
              value={tpe}
              active={active === "tpe"}
              onSelect={() => selectField("tpe")}
            />

            <div className="rounded-xl bg-gray-50 p-4 space-y-1.5 text-sm">
              <Row label="Total" value={`${total.toFixed(2)} DH`} />
              <Row label="Saisi" value={`${paid.toFixed(2)} DH`} />
              <Row
                label={remaining >= 0 ? "Reste à payer" : "Dépassement"}
                value={`${Math.abs(remaining).toFixed(2)} DH`}
                className={cn(
                  "font-semibold",
                  Math.abs(remaining) < 0.005
                    ? "text-emerald-600"
                    : "text-red-600"
                )}
              />
            </div>

            {error && <ErrorBox message={error} />}

            <div className="mt-auto flex gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setView("choose")}
                className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <ArrowLeft className="size-5" /> Retour
              </button>
              <button
                type="button"
                disabled={!mixteValid || busy}
                onClick={confirmMixte}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {submitting === "MIXTE" ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <ArrowLeftRight className="size-5" />
                )}
                Confirmer le paiement mixte
              </button>
            </div>
          </div>

          {/* Right: numpad */}
          <div className="grid grid-cols-3 gap-3 content-start">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"].map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => pressKey(key)}
                  className={cn(
                    "flex h-16 items-center justify-center rounded-xl border border-gray-200 bg-white text-2xl font-semibold text-gray-900 shadow-sm transition active:scale-95 hover:bg-gray-50 disabled:opacity-50",
                    key === "⌫" && "text-red-600"
                  )}
                >
                  {key === "⌫" ? <Delete className="size-6" /> : key}
                </button>
              )
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => pressKey("C")}
              className="col-span-3 h-12 rounded-xl bg-gray-100 font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              Effacer
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---------- Pieces ----------

const COLORS = {
  emerald: {
    icon: "bg-emerald-100 text-emerald-600",
    ring: "ring-emerald-500 border-emerald-500",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
  },
  blue: {
    icon: "bg-blue-100 text-blue-600",
    ring: "ring-blue-500 border-blue-500",
    soft: "bg-blue-50",
    text: "text-blue-700",
  },
  violet: {
    icon: "bg-violet-100 text-violet-600",
    ring: "ring-violet-500 border-violet-500",
    soft: "bg-violet-50",
    text: "text-violet-700",
  },
};

function MethodCard({
  icon: Icon,
  label,
  hint,
  color,
  armed = false,
  loading = false,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
  color: keyof typeof COLORS;
  armed?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const c = COLORS[color];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-7 text-center transition-all hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none",
        armed && cn("ring-4 ring-offset-2", c.ring, c.soft)
      )}
    >
      <span
        className={cn(
          "flex size-20 items-center justify-center rounded-full transition-transform group-hover:scale-105",
          c.icon,
          armed && "animate-pulse"
        )}
      >
        {loading ? (
          <Loader2 className="size-10 animate-spin" />
        ) : (
          <Icon className="size-10" strokeWidth={1.75} />
        )}
      </span>
      <span className="text-lg font-semibold text-gray-900">{label}</span>
      <span
        className={cn(
          "text-xs",
          armed ? cn("font-semibold", c.text) : "text-gray-500"
        )}
      >
        {armed ? "Cliquez encore pour confirmer" : hint}
      </span>
    </button>
  );
}

function AmountField({
  icon: Icon,
  label,
  color,
  value,
  active,
  onSelect,
}: {
  icon: LucideIcon;
  label: string;
  color: keyof typeof COLORS;
  value: string;
  active: boolean;
  onSelect: () => void;
}) {
  const c = COLORS[color];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex items-center gap-4 rounded-xl border-2 bg-white p-4 text-left transition-all",
        active ? cn("ring-2", c.ring, c.soft) : "border-gray-200 hover:border-gray-300"
      )}
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-full",
          c.icon
        )}
      >
        <Icon className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-gray-500">{label}</span>
        <span className="flex items-baseline gap-1 text-2xl font-bold text-gray-900">
          {value || "0"}
          {active && (
            <span className="h-6 w-0.5 translate-y-0.5 animate-pulse bg-gray-900" />
          )}
          <span className="ml-1 text-base font-medium text-gray-500">DH</span>
        </span>
      </span>
    </button>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-between", className)}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

function SuccessView({ payment }: { payment: Payment }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <svg className="payment-success size-28" viewBox="0 0 52 52">
        <circle
          className="payment-success-circle"
          cx="26"
          cy="26"
          r="24"
          fill="none"
        />
        <path
          className="payment-success-check"
          fill="none"
          d="M15 27l7 7 15-15"
        />
      </svg>
      <div className="payment-success-text space-y-1">
        <p className="text-2xl font-bold text-gray-900">
          Paiement {LABELS[payment.method]} confirmé
        </p>
        <p className="text-gray-500">
          {payment.method === "MIXTE"
            ? `Espèces ${payment.cash.toFixed(2)} DH + TPE ${payment.tpe.toFixed(2)} DH`
            : `${(payment.cash + payment.tpe).toFixed(2)} DH`}
        </p>
      </div>
    </div>
  );
}
