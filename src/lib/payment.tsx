import { Banknote, CreditCard, ArrowLeftRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethod = "CASH" | "TPE" | "MIXTE";

export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "TPE", "MIXTE"];

export const PAYMENT_INFO: Record<
  PaymentMethod,
  { label: string; icon: LucideIcon; badge: string }
> = {
  CASH: {
    label: "Espèces",
    icon: Banknote,
    badge: "bg-emerald-100 text-emerald-700",
  },
  TPE: {
    label: "TPE",
    icon: CreditCard,
    badge: "bg-blue-100 text-blue-700",
  },
  MIXTE: {
    label: "Mixte",
    icon: ArrowLeftRight,
    badge: "bg-violet-100 text-violet-700",
  },
};

interface SalePayment {
  total: number;
  payment_method?: PaymentMethod;
  paid_cash?: number;
  paid_tpe?: number;
}

/** Cash / TPE part of a sale. Sales saved before payment methods existed count as cash. */
export function saleAmounts(sale: SalePayment) {
  const method = sale.payment_method ?? "CASH";
  if (method === "MIXTE") {
    return { method, cash: sale.paid_cash ?? 0, tpe: sale.paid_tpe ?? 0 };
  }
  return method === "TPE"
    ? { method, cash: 0, tpe: sale.total }
    : { method, cash: sale.total, tpe: 0 };
}

function Badge({ method, children }: { method: PaymentMethod; children: React.ReactNode }) {
  const info = PAYMENT_INFO[method];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        info.badge
      )}
    >
      <info.icon className="size-3.5" />
      {children}
    </span>
  );
}

/** Shows how a sale was paid. A mixed sale is shown as its cash and TPE parts. */
export function PaymentBadge({ sale }: { sale: SalePayment }) {
  const { method, cash, tpe } = saleAmounts(sale);
  if (method !== "MIXTE") {
    return <Badge method={method}>{PAYMENT_INFO[method].label}</Badge>;
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge method="CASH">Espèces {cash.toFixed(2)}</Badge>
      <Badge method="TPE">TPE {tpe.toFixed(2)}</Badge>
    </div>
  );
}
