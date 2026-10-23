import { useEffect, useState } from "react";
import { format } from "date-fns";
import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import Modal from "@/components/ui/Modal";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import type { Shift } from "@/contexts/ShiftContext";
import { cn } from "@/lib/utils";
import ShiftTicketsPanel from "@/components/ticketRequests/ShiftTicketsPanel";
import { formatDH, formatDuration } from "./utils";

interface SummaryLine {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

interface ShiftDetails {
  shift: Shift;
  services: SummaryLine[];
  products: SummaryLine[];
}

interface CurrentShiftSummaryModalProps {
  open: boolean;
  onClose: () => void;
}

/** Simple summary of the user's open shift, opened from the navbar */
export default function CurrentShiftSummaryModal({
  open,
  onClose,
}: CurrentShiftSummaryModalProps) {
  const [details, setDetails] = useState<ShiftDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"summary" | "tickets">("summary");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTab("summary");
    setLoading(true);
    api
      .get("/shifts/current/details")
      .then((response) => {
        if (!cancelled) setDetails(response.data.data);
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(err, "Impossible de charger le shift.");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const shift = details?.shift;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Shift en cours"
      description={
        shift
          ? `${shift.local.name} · depuis ${format(new Date(shift.opened_at), "dd/MM/yyyy HH:mm")} (${formatDuration(
              shift.opened_at,
              new Date().toISOString(),
            )})`
          : undefined
      }
    >
      {loading && !details ? (
        <LoadingSpinning inline label="Chargement du shift…" />
      ) : details && shift ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Tickets", value: String(shift.summary.count) },
              { label: "Services", value: formatDH(shift.summary.services) },
              { label: "Produits", value: formatDH(shift.summary.products) },
              { label: "Total", value: formatDH(shift.summary.total) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(
              [
                ["summary", "Résumé"],
                ["tickets", `Tickets (${shift.summary.count})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                  tab === key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "summary" ? (
            <>
              <LinesTable
                title="Services"
                lines={details.services}
                empty="Aucun service vendu."
              />
              <LinesTable
                title="Produits"
                lines={details.products}
                empty="Aucun produit vendu."
              />
            </>
          ) : (
            <ShiftTicketsPanel shiftId={shift.id} />
          )}
        </div>
      ) : null}
    </Modal>
  );
}

function LinesTable({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: SummaryLine[];
  empty: string;
}) {
  const th = "px-3 py-2 text-xs font-semibold uppercase text-gray-500";
  const td = "px-3 py-1.5 whitespace-nowrap";

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-700">
        {title}
      </h3>
      {lines.length === 0 ? (
        <p className="rounded-lg border p-4 text-center text-sm text-gray-500">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="mobile-cards w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className={`${th} text-left`}>Nom</th>
                <th className={`${th} text-right`}>Qté</th>
                <th className={`${th} text-right`}>P.U</th>
                <th className={`${th} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lines.map((line) => (
                <tr key={`${line.name}|${line.price}`}>
                  <td className="px-3 py-1.5">{line.name}</td>
                  <td className={`${td} text-right`}>{line.quantity}</td>
                  <td className={`${td} text-right text-gray-600`}>
                    {formatDH(line.price)}
                  </td>
                  <td className={`${td} text-right font-medium`}>
                    {formatDH(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-3 py-2">Total</td>
                <td className={`${td} text-right`}>
                  {lines.reduce((s, l) => s + l.quantity, 0)}
                </td>
                <td />
                <td className={`${td} text-right`}>
                  {formatDH(lines.reduce((s, l) => s + l.total, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
