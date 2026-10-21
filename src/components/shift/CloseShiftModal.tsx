import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2Icon, Loader2, PrinterIcon } from "lucide-react";
import Modal from "@/components/ui/Modal";
import type { Shift } from "@/contexts/ShiftContext";
import { apiErrorMessage, formatDH, formatDuration } from "./utils";

interface CloseShiftModalProps {
  open: boolean;
  /** the user's open shift */
  shift: Shift | null;
  /** set once a shift is closed: the modal then offers to print its ticket */
  closedShift: Shift | null;
  onClose: () => void;
  /** throw to show an error in the modal */
  onConfirm: () => Promise<unknown>;
  onPrint: () => void;
}

export default function CloseShiftModal({
  open,
  shift,
  closedShift,
  onClose,
  onConfirm,
  onPrint,
}: CloseShiftModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible de clôturer le shift."));
    } finally {
      setSubmitting(false);
    }
  };

  const shown = closedShift ?? shift;

  return (
    <Modal
      open={open && !!shown}
      onClose={onClose}
      closeDisabled={submitting}
      size="sm"
      title={closedShift ? "Shift clôturé" : "Clôturer le shift"}
      description={
        closedShift
          ? "Voulez-vous imprimer le ticket de clôture ?"
          : "Vérifiez la caisse avant de clôturer."
      }
      footer={
        closedShift ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border bg-white py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              Non merci
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                onPrint();
                onClose();
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-main py-3 font-medium text-white transition-colors hover:bg-main-dark"
            >
              <PrinterIcon className="size-5" />
              Imprimer le ticket
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 py-3 font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="size-5 animate-spin" />}
            Clôturer le shift
          </button>
        )
      }
    >
      {shown && (
        <div className="flex flex-col gap-4">
          {closedShift && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 font-medium text-green-700">
              <CheckCircle2Icon className="size-5" />
              Le shift #{closedShift.id} est clôturé.
            </div>
          )}

          <ShiftDetails shift={shown} />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </Modal>
  );
}

function ShiftDetails({ shift }: { shift: Shift }) {
  const { summary } = shift;
  const end = shift.closed_at ?? new Date().toISOString();

  const rows: [string, string][] = [
    ["Caissier", shift.user.name],
    ["Local", shift.local.name],
    ["Ouverture", format(new Date(shift.opened_at), "Pp", { locale: fr })],
    ...(shift.closed_at
      ? [
          [
            "Clôture",
            format(new Date(shift.closed_at), "Pp", { locale: fr }),
          ] as [string, string],
        ]
      : []),
    ["Durée", formatDuration(shift.opened_at, end)],
    ["Nombre de ventes", String(summary.count)],
    ["Fond de caisse", formatDH(shift.fond_caisse)],
    ["Ventes espèces", formatDH(summary.cash)],
    ["Ventes TPE", formatDH(summary.tpe)],
    ["Total ventes", formatDH(summary.total)],
  ];

  return (
    <div className="rounded-lg border">
      <dl className="divide-y">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-between gap-4 rounded-b-lg bg-gray-50 px-4 py-3 text-lg">
        <span className="font-medium">Caisse (fond + espèces)</span>
        <span className="font-bold">{formatDH(shift.balance)}</span>
      </div>
    </div>
  );
}
