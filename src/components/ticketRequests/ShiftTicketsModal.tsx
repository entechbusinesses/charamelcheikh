import Modal from "@/components/ui/Modal";
import ShiftTicketsPanel from "./ShiftTicketsPanel";

interface ShiftTicketsModalProps {
  /** id of the shift to show, null when closed */
  shiftId: number | null;
  onClose: () => void;
}

/** Popup with the tickets of a shift (edit / delete requests included) */
export default function ShiftTicketsModal({
  shiftId,
  onClose,
}: ShiftTicketsModalProps) {
  return (
    <Modal
      open={shiftId !== null}
      onClose={onClose}
      size="md"
      title={`Tickets du shift #${shiftId ?? ""}`}
      description="Une modification ou suppression doit être validée par un administrateur"
    >
      {shiftId !== null && <ShiftTicketsPanel shiftId={shiftId} />}
    </Modal>
  );
}
