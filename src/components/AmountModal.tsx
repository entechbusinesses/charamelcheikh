import { useEffect, useState, type FormEvent } from "react";
import Modal from "@/components/ui/Modal";

interface AmountModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

/** Asks for a free amount (in DH) for an open-price item */
export default function AmountModal({
  open,
  title,
  onClose,
  onSubmit,
}: AmountModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(value);

    // prices are stored as whole DH
    if (!Number.isInteger(amount) || amount <= 0) {
      setError("Veuillez saisir un montant entier supérieur à 0.");
      return;
    }

    onSubmit(amount);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description="Saisissez le montant (prix) à ajouter au panier."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
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
          className="w-full bg-main hover:bg-main-dark text-white py-3 rounded-lg font-medium transition-colors"
        >
          Ajouter au panier
        </button>
      </form>
    </Modal>
  );
}
