import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Loader2,
  MinusIcon,
  PlusIcon,
  SendIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import api from "@/apis/api";
import { apiErrorMessage, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import { formatDH } from "@/components/shift/utils";
import { lineId, type RequestType, type ShiftSale } from "./types";

interface TicketRequestModalProps {
  /** ticket concerned, null when closed */
  sale: ShiftSale | null;
  mode: RequestType;
  onClose: () => void;
  /** called once the request is saved */
  onSent: () => void;
}

/**
 * Cashier: asks the admin to delete a ticket, or to change the quantity of
 * its lines / remove some of them. Nothing changes until an admin validates.
 */
export default function TicketRequestModal({
  sale,
  mode: initialMode,
  onClose,
  onSent,
}: TicketRequestModalProps) {
  const [mode, setMode] = useState<RequestType>(initialMode);
  // requested quantity by line id
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sale) return;
    setMode(initialMode);
    setQuantities(
      Object.fromEntries(sale.lines.map((l) => [l.id, l.quantity])),
    );
    setReason("");
    setError(null);
  }, [sale, initialMode]);

  if (!sale) return null;

  const qty = (id: string) => quantities[id] ?? 0;
  const setQty = (id: string, value: number) =>
    setQuantities((q) => ({ ...q, [id]: Math.max(0, Math.min(999, value)) }));

  const changed = sale.lines.filter((l) => qty(l.id) !== l.quantity);
  const newTotal = sale.lines.reduce((s, l) => s + l.price * qty(l.id), 0);
  const allRemoved = sale.lines.every((l) => qty(l.id) === 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/ticket-requests", {
        sale_id: sale.id,
        type: mode,
        reason,
        changes:
          mode === "EDIT"
            ? changed.map((l) => ({
                type: l.type,
                id: lineId(l),
                quantity: qty(l.id),
              }))
            : undefined,
      });
      notifySuccess("Demande envoyée à l'administrateur.");
      onSent();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Impossible d'envoyer la demande."));
    } finally {
      setSubmitting(false);
    }
  };

  const isDelete = mode === "DELETE" || allRemoved;
  const canSubmit = mode === "DELETE" || changed.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      closeDisabled={submitting}
      size="md"
      title={
        mode === "DELETE"
          ? `Supprimer le ticket #${sale.id}`
          : `Modifier le ticket #${sale.id}`
      }
      description={`${format(new Date(sale.date), "dd/MM/yyyy HH:mm")} · ${formatDH(
        sale.total,
      )} · la demande sera validée par un administrateur`}
      footer={
        <div className="flex flex-col gap-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !canSubmit}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg py-3 font-medium text-white transition-colors disabled:opacity-50",
              isDelete
                ? "bg-red-600 hover:bg-red-700"
                : "bg-main hover:bg-main-dark",
            )}
          >
            {submitting ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <SendIcon className="size-5" />
            )}
            {isDelete
              ? "Demander la suppression du ticket"
              : `Demander la modification (${changed.length} ligne${
                  changed.length > 1 ? "s" : ""
                })`}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {mode === "EDIT" ? (
          <>
            <p className="text-sm text-gray-600">
              Changez les quantités avec − / + ou retirez une ligne avec la
              corbeille.
            </p>
            <ul className="divide-y rounded-lg border">
              {sale.lines.map((line) => {
                const q = qty(line.id);
                const removed = q === 0;
                const edited = q !== line.quantity;
                return (
                  <li
                    key={line.id}
                    className={cn(
                      "flex flex-wrap items-center gap-3 px-3 py-2",
                      removed && "bg-red-50",
                      edited && !removed && "bg-amber-50",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "font-medium",
                          removed && "text-gray-400 line-through",
                        )}
                      >
                        {line.name}
                        {line.pack_name && (
                          <span className="ml-1 text-xs text-gray-500">
                            (pack {line.pack_name})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {line.type === "service" ? "Service" : "Produit"} ·{" "}
                        {formatDH(line.price)} / u
                        {edited && ` · avant : ${line.quantity}`}
                      </p>
                    </div>

                    {removed ? (
                      <button
                        type="button"
                        onClick={() => setQty(line.id, line.quantity)}
                        className="flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <Undo2Icon className="size-4" />
                        Garder
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQty(line.id, q - 1)}
                          aria-label="Diminuer"
                          className="flex size-9 items-center justify-center rounded-lg border bg-white hover:bg-gray-100"
                        >
                          <MinusIcon className="size-4" />
                        </button>
                        <span className="w-8 text-center font-semibold">
                          {q}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.id, q + 1)}
                          aria-label="Augmenter"
                          className="flex size-9 items-center justify-center rounded-lg border bg-white hover:bg-gray-100"
                        >
                          <PlusIcon className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQty(line.id, 0)}
                          title="Retirer cette ligne"
                          aria-label="Retirer cette ligne"
                          className="ml-1 flex size-9 items-center justify-center rounded-lg bg-red-100 text-red-600 hover:bg-red-200"
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    )}

                    <span className="w-24 text-right font-medium">
                      {formatDH(line.price * q)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
              <span className="text-gray-600">Nouveau total</span>
              <span className="text-lg font-bold">
                {newTotal !== sale.total && (
                  <span className="mr-2 text-sm font-normal text-gray-400 line-through">
                    {formatDH(sale.total)}
                  </span>
                )}
                {formatDH(newTotal)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMode("DELETE")}
              className="flex items-center gap-1 text-sm text-red-600 hover:underline"
            >
              <Trash2Icon className="size-4" />
              Supprimer tout le ticket à la place
            </button>
          </>
        ) : (
          <>
            <ul className="divide-y rounded-lg border text-sm">
              {sale.lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>
                    {line.name}
                    {line.pack_name && (
                      <span className="ml-1 text-xs text-gray-500">
                        (pack {line.pack_name})
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap text-gray-600">
                    {line.quantity} × {formatDH(line.price)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Tout le ticket ({formatDH(sale.total)}) sera supprimé si
              l'administrateur valide.
            </p>
            {initialMode === "EDIT" && (
              <button
                type="button"
                onClick={() => setMode("EDIT")}
                className="flex items-center gap-1 text-sm text-gray-600 hover:underline"
              >
                <Undo2Icon className="size-4" />
                Revenir à la modification
              </button>
            )}
          </>
        )}

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Motif (optionnel)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Ex : erreur de saisie, client a annulé…"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>
    </Modal>
  );
}
