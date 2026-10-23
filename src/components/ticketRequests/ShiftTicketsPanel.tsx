import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ClockIcon, PencilIcon, Trash2Icon } from "lucide-react";
import api from "@/apis/api";
import { notifyError } from "@/lib/notify";
import { useAuth } from "@/contexts/AuthContext";
import { useShift } from "@/contexts/ShiftContext";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { formatDH } from "@/components/shift/utils";
import TicketRequestModal from "./TicketRequestModal";
import {
  PAYMENT_LABELS,
  type RequestType,
  type ShiftSale,
} from "./types";

const STATUS_BADGES = {
  PENDING: {
    className: "bg-amber-100 text-amber-800",
    label: (type: RequestType) =>
      type === "DELETE" ? "Suppression demandée" : "Modification demandée",
  },
  APPROVED: {
    className: "bg-green-100 text-green-700",
    label: (type: RequestType) =>
      type === "DELETE" ? "Suppression validée" : "Modification validée",
  },
  REJECTED: {
    className: "bg-red-100 text-red-700",
    label: (type: RequestType) =>
      type === "DELETE" ? "Suppression refusée" : "Modification refusée",
  },
};

/**
 * Tickets of a shift with their lines. The cashier who owns them can ask
 * the admin to delete a ticket or to edit its lines.
 */
export default function ShiftTicketsPanel({ shiftId }: { shiftId: number }) {
  const { user } = useAuth();
  const { refresh: refreshShift } = useShift();
  const [sales, setSales] = useState<ShiftSale[]>([]);
  const [canRequest, setCanRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<{
    sale: ShiftSale;
    mode: RequestType;
  } | null>(null);

  const fetchSales = useCallback(async () => {
    try {
      const response = await api.get(`/shifts/${shiftId}/sales`);
      // newest ticket first: the one to fix is usually the last one
      setSales([...response.data.data.sales].reverse());
      // admins edit tickets directly from the tickets page
      setCanRequest(
        user?.role !== "ADMIN" &&
          response.data.data.shift.user.id === user?.id,
      );
    } catch (err) {
      notifyError(err, "Impossible de charger les tickets.");
    } finally {
      setLoading(false);
    }
  }, [shiftId, user?.id, user?.role]);

  useEffect(() => {
    setLoading(true);
    fetchSales();
  }, [fetchSales]);

  if (loading) return <LoadingSpinning inline label="Chargement des tickets…" />;

  if (sales.length === 0) {
    return (
      <p className="rounded-lg border p-6 text-center text-gray-500">
        Aucun ticket dans ce shift.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sales.map((sale) => {
        const pending = sale.request?.status === "PENDING";
        const badge = sale.request && STATUS_BADGES[sale.request.status];
        return (
          <section key={sale.id} className="rounded-lg border">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-semibold">Ticket #{sale.id}</span>
                <span className="text-gray-500">
                  {" · "}
                  {format(new Date(sale.date), "HH:mm")}
                  {" · "}
                  {PAYMENT_LABELS[sale.payment_method]}
                  {sale.payment_method === "MIXTE" &&
                    ` (${formatDH(sale.cash)} esp. + ${formatDH(sale.tpe)} TPE)`}
                </span>
                <span className="ml-2 font-bold text-gray-900">
                  {formatDH(sale.total)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {badge && sale.request && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                  >
                    {pending && <ClockIcon className="size-3" />}
                    {badge.label(sale.request.type)}
                  </span>
                )}
                {canRequest && !pending && (
                  <>
                    <button
                      type="button"
                      onClick={() => setRequest({ sale, mode: "EDIT" })}
                      title="Demander une modification de ce ticket"
                      className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                    >
                      <PencilIcon className="size-3.5" />
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequest({ sale, mode: "DELETE" })}
                      title="Demander la suppression de ce ticket"
                      className="flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-200"
                    >
                      <Trash2Icon className="size-3.5" />
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </header>
            <table className="mobile-cards w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {sale.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="px-3 py-1.5">
                      {line.name}
                      {line.pack_name && (
                        <span className="ml-1 text-xs text-gray-500">
                          (pack {line.pack_name})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap text-gray-600">
                      {line.quantity} × {formatDH(line.price)}
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap font-medium">
                      {formatDH(line.price * line.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      <TicketRequestModal
        sale={request?.sale ?? null}
        mode={request?.mode ?? "DELETE"}
        onClose={() => setRequest(null)}
        onSent={() => {
          fetchSales();
          refreshShift();
        }}
      />
    </div>
  );
}
