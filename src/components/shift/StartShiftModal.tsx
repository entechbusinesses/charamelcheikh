import { useEffect, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangleIcon, Loader2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { LocalShift } from "@/contexts/ShiftContext";
import { apiErrorMessage } from "./utils";

interface StartShiftModalProps {
  open: boolean;
  /** open shift of another user in this local: starting is blocked */
  localShift: LocalShift | null;
  isAdmin: boolean;
  onClose: () => void;
  /** throw to show an error in the modal */
  onStart: (fondCaisse: number) => Promise<void>;
  onForceClose: () => Promise<void>;
}

/** Starts a shift with its fond de caisse */
export default function StartShiftModal({
  open,
  localShift,
  isAdmin,
  onClose,
  onStart,
  onForceClose,
}: StartShiftModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(value);

    if (value.trim() === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Veuillez saisir un fond de caisse valide (0 ou plus).");
      return;
    }

    setSubmitting(true);
    try {
      await onStart(amount);
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de démarrer le shift."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForceClose = async () => {
    if (
      !window.confirm(
        `Clôturer le shift de ${localShift?.user.name} ? Ses ventes seront arrêtées.`,
      )
    )
      return;
    setSubmitting(true);
    try {
      await onForceClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de clôturer ce shift."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={submitting}
      size="sm"
      title="Démarrer un shift"
      description="Saisissez le fond de caisse présent dans la caisse."
    >
      {localShift ? (
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <AlertTriangleIcon className="size-6 shrink-0" />
            <p>
              Un shift est déjà en cours dans ce local par{" "}
              <span className="font-semibold">{localShift.user.name}</span>{" "}
              depuis le{" "}
              {format(new Date(localShift.opened_at), "Pp", { locale: fr })}.
              Il doit être clôturé avant d'en démarrer un nouveau.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {isAdmin && (
            <button
              type="button"
              onClick={handleForceClose}
              disabled={submitting}
              className="w-full rounded-lg bg-red-600 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              {submitting ? "Clôture..." : `Clôturer le shift de ${localShift.user.name}`}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="text-sm font-medium text-gray-700">
            Fond de caisse
          </label>
          <div className="relative -mt-2">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              placeholder="0"
              className="w-full rounded-lg border px-4 py-3 pr-14 text-2xl font-semibold outline-none focus:ring-2 focus:ring-main"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg font-medium text-gray-500">
              DH
            </span>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-main py-3 font-medium text-white transition-colors hover:bg-main-dark disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-5 animate-spin" />}
            Démarrer le shift
          </button>
        </form>
      )}
    </Modal>
  );
}
