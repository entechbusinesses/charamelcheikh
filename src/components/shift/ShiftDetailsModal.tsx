import { useEffect, useState } from "react";
import { format } from "date-fns";
import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import Modal from "@/components/ui/Modal";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import type { Shift } from "@/contexts/ShiftContext";
import { formatDH, formatDuration } from "./utils";

interface SaleLine {
  id: string;
  type: "service" | "product";
  name: string;
  price: number;
  quantity: number;
  frais: number;
  pack_name: string | null;
}

interface ShiftSale {
  id: number;
  date: string;
  total: number;
  payment_method: "CASH" | "TPE" | "MIXTE";
  cash: number;
  tpe: number;
  lines: SaleLine[];
}

const PAYMENT_LABELS: Record<ShiftSale["payment_method"], string> = {
  CASH: "Espèces",
  TPE: "TPE",
  MIXTE: "Mixte",
};

interface ShiftDetailsModalProps {
  /** id of the shift to show, null when closed */
  shiftId: number | null;
  onClose: () => void;
}

/** Read-only detail of a shift: totals and every ticket with its lines */
export default function ShiftDetailsModal({
  shiftId,
  onClose,
}: ShiftDetailsModalProps) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [sales, setSales] = useState<ShiftSale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (shiftId === null) return;
    let cancelled = false;
    setLoading(true);
    setShift(null);
    setSales([]);
    api
      .get(`/shifts/${shiftId}/sales`)
      .then((response) => {
        if (cancelled) return;
        setShift(response.data.data.shift);
        setSales(response.data.data.sales);
      })
      .catch((err) => {
        if (!cancelled) {
          notifyError(err, "Impossible de charger ce shift.");
          onClose();
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  const stats = shift
    ? [
        { label: "Ventes", value: String(shift.summary.count) },
        { label: "Fond de caisse", value: formatDH(shift.fond_caisse) },
        { label: "Espèces", value: formatDH(shift.summary.cash) },
        { label: "TPE", value: formatDH(shift.summary.tpe) },
        { label: "Total ventes", value: formatDH(shift.summary.total) },
        { label: "Caisse attendue", value: formatDH(shift.balance) },
      ]
    : [];

  return (
    <Modal
      open={shiftId !== null}
      onClose={onClose}
      size="lg"
      title={`Détails du shift #${shiftId ?? ""}`}
      description={
        shift
          ? `${shift.user.name} · ${shift.local.name} · ${format(new Date(shift.opened_at), "dd/MM/yyyy HH:mm")} → ${
              shift.closed_at
                ? format(new Date(shift.closed_at), "dd/MM/yyyy HH:mm")
                : "en cours"
            } (${formatDuration(shift.opened_at, shift.closed_at ?? new Date().toISOString())})`
          : "Consultation uniquement"
      }
    >
      {loading ? (
        <LoadingSpinning />
      ) : shift ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {sales.length === 0 ? (
            <p className="p-6 text-center text-gray-500">
              Aucun ticket dans ce shift.
            </p>
          ) : (
            <div className="space-y-3">
              {sales.map((sale) => (
                <section key={sale.id} className="rounded-lg border">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-4 py-2 text-sm">
                    <span className="font-semibold">
                      Ticket #{sale.id} ·{" "}
                      {format(new Date(sale.date), "dd/MM/yyyy HH:mm")}
                    </span>
                    <span className="text-gray-600">
                      {PAYMENT_LABELS[sale.payment_method]}
                      {sale.payment_method === "MIXTE" &&
                        ` (${formatDH(sale.cash)} esp. + ${formatDH(sale.tpe)} TPE)`}
                      {" · "}
                      <span className="font-bold text-gray-900">
                        {formatDH(sale.total)}
                      </span>
                    </span>
                  </header>
                  <table className="mobile-cards w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {sale.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-1.5">
                            {line.name}
                            {line.pack_name && (
                              <span className="ml-1 text-xs text-gray-500">
                                (pack {line.pack_name})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-1.5 text-right whitespace-nowrap text-gray-600">
                            {line.quantity} × {formatDH(line.price)}
                          </td>
                          <td className="px-4 py-1.5 text-right whitespace-nowrap font-medium">
                            {formatDH(line.price * line.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
