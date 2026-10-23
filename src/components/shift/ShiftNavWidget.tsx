import { useEffect, useRef, useState } from "react";
import { LockIcon, PlayIcon, WalletIcon } from "lucide-react";
import { useShift } from "@/contexts/ShiftContext";
import { cn } from "@/lib/utils";
import { formatDH } from "./utils";
import CurrentShiftSummaryModal from "./CurrentShiftSummaryModal";

/** Navbar: live cash balance of the user's shift, or a button to start one */
export default function ShiftNavWidget() {
  const { shift, localShift, loading, openStart, openClose } = useShift();
  const [bumped, setBumped] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const lastBalance = useRef<number | null>(null);

  // short highlight each time the balance changes (new sale)
  useEffect(() => {
    const balance = shift?.balance ?? null;
    if (
      balance !== null &&
      lastBalance.current !== null &&
      balance !== lastBalance.current
    ) {
      setBumped(true);
      const timer = setTimeout(() => setBumped(false), 1200);
      lastBalance.current = balance;
      return () => clearTimeout(timer);
    }
    lastBalance.current = balance;
  }, [shift?.balance]);

  if (loading) return null;

  if (!shift) {
    return (
      <div className="flex items-center gap-3">
        {localShift && (
          <div className="text-right text-xs text-amber-700">
            Shift en cours
            <div className="font-medium">{localShift.user.name}</div>
          </div>
        )}
        <button
          onClick={openStart}
          className="flex items-center gap-2 rounded-lg bg-main px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-main-dark"
        >
          <PlayIcon className="size-4" />
          Démarrer un shift
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-left text-gray-600 transition-colors hover:bg-gray-100"
        title={`Fond de caisse ${formatDH(shift.fond_caisse)} + espèces ${formatDH(
          shift.summary.cash,
        )} — TPE ${formatDH(shift.summary.tpe)} · cliquer pour les détails`}
      >
        <div className="flex size-8 items-center justify-center rounded-full bg-green-600">
          <WalletIcon className="size-4 text-white" />
        </div>
        <div className="text-sm">
          <div
            className={cn(
              "origin-left font-semibold text-gray-900 transition-all duration-300",
              bumped && "scale-110 text-green-600",
            )}
          >
            Caisse : {formatDH(shift.balance)}
          </div>
          <div className="text-xs text-gray-500">
            Fond {formatDH(shift.fond_caisse)} · {shift.summary.count} vente
            {shift.summary.count > 1 ? "s" : ""}
          </div>
        </div>
      </button>
      <CurrentShiftSummaryModal
        open={showDetails}
        onClose={() => setShowDetails(false)}
      />
      <button
        onClick={openClose}
        className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-200"
        title="Clôturer le shift"
      >
        <LockIcon className="size-4" />
        Clôturer
      </button>
    </div>
  );
}
