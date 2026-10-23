import {
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Item, keptQuantity } from "@/pages/Pos";
import SafeImage from "@/components/ui/SafeImage";

interface GymPaymentTicketProps {
  paidAmount: number;
  cart: Item[];
}

export interface PrintPreferences {
  logo: boolean;
  barcode: boolean;
  qr: boolean;
  message: boolean;
  notes: boolean;
  tonamed: boolean;
}

export default function TikcetClient({
  paidAmount = 0,
  cart = [],
}: GymPaymentTicketProps) {
  const { user } = useAuth();

  console.log();

  return (
    <div className="w-[88mm] bg-white text-black">
      <CardHeader className="text-center">
        <SafeImage
          path={user?.local?.logo_url}
          className="mb-5 h-20 object-contain rounded-md w-max mx-auto filter grayscale contrast-200"
          fallback={null}
        />
        <div
          className={cn(
            "flex items-start text-start justify-between mb-4",
            "text-center justify-center",
          )}
        >
          <div>
            <CardTitle className={cn("text-2xl font-bold")}>
              {user?.local.name}
            </CardTitle>
            <p className="text-sm underline capitalize">Ticket Client</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <table className="w-full border border-black">
          <thead>
            <th className="font-bold text-start border border-black p-1">
              Nom
            </th>
            <th className="font-bold text-start border border-black p-1">
              Prix
            </th>
            <th className="font-bold text-start border border-black p-1">
              Qté
            </th>
          </thead>
          <tbody>
            {cart.map((item) => (
              <tr key={`${item.type}-${item.id}`}>
                <td className="p-1 border border-black">
                  {item.name}
                  {item.type === "pack" && (
                    <ul className="text-xs pl-2">
                      {item.serviceNames?.map((name) => (
                        <li key={name}>- {name}</li>
                      ))}
                      {item.packProducts
                        ?.filter((p) => keptQuantity(p, item.quantity || 1) > 0)
                        .map((p) => (
                          <li key={p.id}>
                            - {keptQuantity(p, item.quantity || 1)} x {p.name}
                          </li>
                        ))}
                    </ul>
                  )}
                </td>
                <td className="p-1 border border-black">
                  {item.price.toFixed(2)}
                </td>
                <td className="p-1 border border-black">x {item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between items-center">
          <Label className="font-medium underline">Total:</Label>
          <span>{paidAmount.toFixed(2)} DH</span>
        </div>

        <div className="flex justify-between  items-center">
          <Label className="font-medium underline">Date:</Label>
          <span>
            {format(new Date(), "P", { locale: fr })} à{" "}
            {format(new Date(), "p", { locale: fr })}
          </span>
        </div>
      </CardContent>

      <hr className="mb-5 border" />

      <CardFooter className="flex flex-col items-center text-center text-sm text-gray-800">
        <p>
          Merci pour votre visite. Veuillez conserver ce ticket pour vos
          archives.
        </p>
      </CardFooter>
    </div>
  );
}
