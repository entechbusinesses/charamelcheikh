import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckIcon, Loader2, PencilIcon, Trash2Icon, XIcon } from "lucide-react";
import api from "@/apis/api";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useShift } from "@/contexts/ShiftContext";
import Modal from "@/components/ui/Modal";
import { LoadingSpinning } from "@/components/ui/loadingspining";
import { formatDH } from "@/components/shift/utils";
import { PAYMENT_LABELS, type TicketRequest } from "./types";

interface TicketRequestsContextType {
  /** pending requests (admins only, always 0 for cashiers) */
  pendingCount: number;
  openRequests: () => void;
}

const TicketRequestsContext = createContext<TicketRequestsContextType>({
  pendingCount: 0,
  openRequests: () => {},
});

export const useTicketRequests = () => useContext(TicketRequestsContext);

const POLL_INTERVAL = 60_000;

/**
 * Admins: loads the pending ticket requests and opens the validation popup
 * as soon as the app opens, then again each time a new request arrives.
 */
export const TicketRequestsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [requests, setRequests] = useState<TicketRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  // requests already shown: the popup reopens only for new ones
  const seen = useRef(new Set<number>());

  const fetchRequests = useCallback(async () => {
    try {
      const response = await api.get("/ticket-requests", {
        params: { status: "PENDING" },
      });
      const pending: TicketRequest[] = response.data.data;
      setRequests(pending);
      if (pending.some((r) => !seen.current.has(r.id))) setOpen(true);
      pending.forEach((r) => seen.current.add(r.id));
    } catch (error) {
      console.error("Error fetching ticket requests:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setRequests([]);
    setOpen(false);
    setLoaded(false);
    seen.current = new Set();
    if (!isAdmin) return;

    fetchRequests();
    const timer = setInterval(fetchRequests, POLL_INTERVAL);
    // back to the app (e.g. from a push notification): check right away
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchRequests();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin, user?.id, fetchRequests]);

  const value: TicketRequestsContextType = {
    pendingCount: requests.length,
    openRequests: () => {
      setOpen(true);
      fetchRequests();
    },
  };

  return (
    <TicketRequestsContext.Provider value={value}>
      {children}
      {isAdmin && (
        <TicketRequestsModal
          open={open}
          loading={!loaded}
          requests={requests}
          onClose={() => setOpen(false)}
          onReviewed={(id) => {
            const left = requests.filter((r) => r.id !== id);
            setRequests(left);
            if (left.length === 0) setOpen(false);
          }}
          onStale={fetchRequests}
        />
      )}
    </TicketRequestsContext.Provider>
  );
};

function TicketRequestsModal({
  open,
  loading,
  requests,
  onClose,
  onReviewed,
  onStale,
}: {
  open: boolean;
  loading: boolean;
  requests: TicketRequest[];
  onClose: () => void;
  onReviewed: (id: number) => void;
  /** a request was handled elsewhere: reload the list */
  onStale: () => void;
}) {
  const { refresh: refreshShift } = useShift();
  const [busy, setBusy] = useState<number | null>(null);

  const review = async (request: TicketRequest, approve: boolean) => {
    setBusy(request.id);
    try {
      await api.post(`/ticket-requests/${request.id}/review`, { approve });
      notifySuccess(
        approve
          ? request.type === "DELETE"
            ? `Ticket #${request.ticket_id} supprimé.`
            : `Ticket #${request.ticket_id} modifié.`
          : `Demande de ${request.user.name} refusée.`,
      );
      onReviewed(request.id);
      if (approve) refreshShift();
    } catch (err) {
      notifyError(err, "Impossible de traiter la demande.");
      onStale();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeDisabled={busy !== null}
      size="md"
      title={`Demandes sur les tickets (${requests.length})`}
      description="Validez ou refusez les demandes des caissiers"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          className="w-full rounded-lg border bg-white py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
        >
          Plus tard
        </button>
      }
    >
      {loading && requests.length === 0 ? (
        <LoadingSpinning inline label="Chargement des demandes…" />
      ) : requests.length === 0 ? (
        <p className="p-6 text-center text-gray-500">
          Aucune demande en attente.
        </p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              busy={busy === request.id}
              disabled={busy !== null}
              onReview={(approve) => review(request, approve)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function RequestCard({
  request,
  busy,
  disabled,
  onReview,
}: {
  request: TicketRequest;
  busy: boolean;
  disabled: boolean;
  onReview: (approve: boolean) => void;
}) {
  const isDelete = request.type === "DELETE";
  const { ticket } = request;
  const newTotal =
    ticket &&
    ticket.total +
      request.changes.reduce((s, c) => s + (c.to - c.from) * c.price, 0);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border-2",
        isDelete ? "border-red-200" : "border-blue-200",
      )}
    >
      <header
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-4 py-2",
          isDelete ? "bg-red-50" : "bg-blue-50",
        )}
      >
        <span
          className={cn(
            "flex items-center gap-1.5 font-semibold",
            isDelete ? "text-red-700" : "text-blue-700",
          )}
        >
          {isDelete ? (
            <Trash2Icon className="size-4" />
          ) : (
            <PencilIcon className="size-4" />
          )}
          {isDelete ? "Supprimer" : "Modifier"} le ticket #{request.ticket_id}
        </span>
        <span className="text-xs text-gray-600">
          {request.user.name} ·{" "}
          {formatDistanceToNow(new Date(request.created_at), {
            addSuffix: true,
            locale: fr,
          })}
        </span>
      </header>

      <div className="space-y-3 px-4 py-3 text-sm">
        {ticket ? (
          <p className="text-gray-600">
            {ticket.local} · {format(new Date(ticket.date), "dd/MM/yyyy HH:mm")}{" "}
            · {PAYMENT_LABELS[ticket.payment_method]} ·{" "}
            <span className="font-semibold text-gray-900">
              {formatDH(ticket.total)}
            </span>
          </p>
        ) : (
          <p className="rounded-md bg-gray-100 p-2 text-gray-600">
            Ce ticket ({formatDH(request.ticket_total)}) a déjà été supprimé.
          </p>
        )}

        {isDelete
          ? ticket && (
              <ul className="divide-y rounded-md border">
                {ticket.lines.map((line) => (
                  <li
                    key={`${line.type}${line.id}`}
                    className="flex justify-between gap-3 px-3 py-1.5"
                  >
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
            )
          : (
              <>
                <ul className="divide-y rounded-md border">
                  {request.changes.map((c) => (
                    <li
                      key={`${c.type}${c.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-1.5"
                    >
                      <span className={cn(c.to === 0 && "line-through")}>
                        {c.name}
                        <span className="ml-1 text-xs text-gray-500">
                          {formatDH(c.price)} / u
                        </span>
                      </span>
                      {c.to === 0 ? (
                        <span className="font-medium text-red-600">
                          Retirer ({c.from})
                        </span>
                      ) : (
                        <span className="whitespace-nowrap font-medium">
                          {c.from} → <span className="text-blue-700">{c.to}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {newTotal !== null && (
                  <p className="text-right">
                    Nouveau total :{" "}
                    <span className="mr-1 text-gray-400 line-through">
                      {formatDH(ticket!.total)}
                    </span>
                    <span className="font-bold">{formatDH(newTotal)}</span>
                  </p>
                )}
              </>
            )}

        {request.reason && (
          <p className="rounded-md bg-amber-50 p-2 text-amber-900">
            <span className="font-medium">Motif :</span> {request.reason}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onReview(false)}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            <XIcon className="size-4" />
            Refuser
          </button>
          <button
            type="button"
            onClick={() => onReview(true)}
            disabled={disabled}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Valider
          </button>
        </div>
      </div>
    </section>
  );
}
