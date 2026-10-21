import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useReactToPrint } from "react-to-print";
import api from "@/apis/api";
import { useAuth } from "@/contexts/AuthContext";
import StartShiftModal from "@/components/shift/StartShiftModal";
import CloseShiftModal from "@/components/shift/CloseShiftModal";
import ShiftTicket from "@/components/shift/ShiftTicket";

export interface ShiftSummary {
  count: number;
  total: number;
  cash: number;
  tpe: number;
  products: number;
  services: number;
  frais: number;
  methods: { CASH: number; TPE: number; MIXTE: number };
}

export interface Shift {
  id: number;
  fond_caisse: number;
  opened_at: string;
  closed_at: string | null;
  user: { id: number; name: string };
  local: { id: number; name: string; type: string; logo_url?: string | null };
  summary: ShiftSummary;
  /** fond de caisse + cash received */
  balance: number;
}

/** Open shift of another user in the same local */
export interface LocalShift {
  id: number;
  opened_at: string;
  user: { id: number; name: string };
}

interface ShiftContextType {
  shift: Shift | null;
  localShift: LocalShift | null;
  loading: boolean;
  refresh: () => Promise<void>;
  openStart: () => void;
  openClose: () => void;
}

const ShiftContext = createContext<ShiftContextType | null>(null);

export const useShift = () => {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error("useShift must be used within a ShiftProvider");
  }
  return context;
};

// keeps the balance up to date with changes made elsewhere (e.g. tickets edited)
const POLL_INTERVAL = 30_000;

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [shift, setShift] = useState<Shift | null>(null);
  const [localShift, setLocalShift] = useState<LocalShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [closedShift, setClosedShift] = useState<Shift | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);
  const printTicket = useReactToPrint({ contentRef: ticketRef });

  const hasLocal = !!user?.local;

  const refresh = useCallback(async () => {
    if (!hasLocal) return;
    try {
      const response = await api.get("/shifts/current");
      setShift(response.data.shift);
      setLocalShift(response.data.localShift);
    } catch (error) {
      console.error("Error fetching shift:", error);
    } finally {
      setLoading(false);
    }
  }, [hasLocal]);

  useEffect(() => {
    setShift(null);
    setLocalShift(null);
    if (!user || !hasLocal) {
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [user?.id, hasLocal, refresh]);

  useEffect(() => {
    if (!shift) return;
    const timer = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [shift?.id, refresh]);

  const startShift = async (fond_caisse: number) => {
    const response = await api.post("/shifts/start", { fond_caisse });
    setShift(response.data.data);
    setLocalShift(null);
  };

  /** Closes the user's shift, or another one (admin) when `id` is given */
  const closeShift = async (id?: number) => {
    const response = await api.post("/shifts/close", { id });
    const closed: Shift = response.data.data;
    setClosedShift(closed);
    await refresh();
    return closed;
  };

  const value: ShiftContextType = {
    shift,
    localShift,
    loading,
    refresh,
    openStart: () => setShowStart(true),
    openClose: () => {
      setClosedShift(null);
      setShowClose(true);
    },
  };

  return (
    <ShiftContext.Provider value={value}>
      {children}

      {user && (
        <>
          <StartShiftModal
            open={showStart}
            localShift={localShift}
            isAdmin={user.role === "ADMIN"}
            onClose={() => setShowStart(false)}
            onStart={async (fond) => {
              await startShift(fond);
              setShowStart(false);
            }}
            onForceClose={async () => {
              if (!localShift) return;
              await closeShift(localShift.id);
              setShowStart(false);
              setShowClose(true);
            }}
          />

          <CloseShiftModal
            open={showClose}
            shift={shift}
            closedShift={closedShift}
            // closedShift is kept so its ticket stays mounted while printing
            onClose={() => setShowClose(false)}
            onConfirm={() => closeShift()}
            onPrint={() => printTicket()}
          />

          <div className="print:block hidden" ref={ticketRef}>
            {closedShift && <ShiftTicket shift={closedShift} />}
          </div>
        </>
      )}
    </ShiftContext.Provider>
  );
};
