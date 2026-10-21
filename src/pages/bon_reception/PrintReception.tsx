// components/PrintReception.tsx
import { format } from "date-fns";

interface PrintableReceptionProps {
  reception: {
    id: number;
    total: number;
    from: {
      name: string;
      type: string;
    };
    to: {
      name: string;
      type: string;
    };
    date: string;
    description: string;
    user: {
      name: string;
    };
    isBough: boolean;
  };
  items: Array<{
    quantity: number;
    price: number;
    product: {
      name: string;
    };
  }>;
}

export default function PrintableReception({
  reception,
  items,
}: PrintableReceptionProps) {
  return (
    <div className="p-4" style={{ fontFamily: "Arial, sans-serif" }}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Bon de Réception</h1>
        <p className="text-sm text-gray-600">
          N°: {reception.id.toString().padStart(3, "0")}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p>
            <strong>Date:</strong> {format(reception.date, "dd/MM/yyyy HH:mm")}
          </p>
          <p>
            <strong>Émetteur:</strong> {reception.user.name}
          </p>
        </div>
        <div>
          <p>
            <strong>Source:</strong>{" "}
            {reception.isBough
              ? "Achat"
              : `${reception.from.name} (${reception.from.type})`}
          </p>
          <p>
            <strong>Destination:</strong> {reception.to.name} (
            {reception.to.type})
          </p>
        </div>
      </div>

      <table className="w-full border-collapse border border-gray-400 mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-400 p-2 text-left">Produit</th>
            <th className="border border-gray-400 p-2 text-left">Quantité</th>
            <th className="border border-gray-400 p-2 text-left">Prix U</th>
            <th className="border border-gray-400 p-2 text-left">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="border border-gray-400 p-2">
                {item.product.name}
              </td>
              <td className="border border-gray-400 p-2">{item.quantity}</td>

              <td className="border border-gray-400 p-2">
                {item.price.toFixed(2)}
              </td>

              <td className="border border-gray-400 p-2">
                {(item.price * item.quantity).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 text-right">
        <p className="font-bold">
          Total du Bon: {reception.total.toFixed(2)} DH
        </p>
      </div>
    </div>
  );
}
