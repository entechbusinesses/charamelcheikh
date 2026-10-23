export type PaymentMethod = "CASH" | "TPE" | "MIXTE";
export type RequestType = "DELETE" | "EDIT";
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Espèces",
  TPE: "TPE",
  MIXTE: "Mixte",
};

/** Line of a ticket as sent by GET /shifts/:id/sales ("s12" / "p34" ids) */
export interface SaleLine {
  id: string;
  type: "service" | "product";
  name: string;
  price: number;
  quantity: number;
  frais: number;
  pack_name: string | null;
}

export interface ShiftSale {
  id: number;
  date: string;
  total: number;
  payment_method: PaymentMethod;
  cash: number;
  tpe: number;
  lines: SaleLine[];
  /** latest delete / edit request of the ticket */
  request: { id: number; type: RequestType; status: RequestStatus } | null;
}

/** Numeric line id ("s12" → 12) */
export const lineId = (line: SaleLine) => Number(line.id.slice(1));

/** One line change of an EDIT request (to = 0 removes the line) */
export interface TicketChange {
  type: "product" | "service";
  id: number;
  name: string;
  price: number;
  from: number;
  to: number;
}

export interface TicketRequest {
  id: number;
  type: RequestType;
  status: RequestStatus;
  reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  ticket_id: number;
  ticket_total: number;
  changes: TicketChange[];
  user: { id: number; name: string };
  reviewer: { id: number; name: string } | null;
  /** current content of the ticket, null once deleted */
  ticket: {
    date: string;
    total: number;
    payment_method: PaymentMethod;
    local: string;
    lines: {
      type: "service" | "product";
      id: number;
      name: string;
      price: number;
      quantity: number;
      pack_name: string | null;
    }[];
  } | null;
}
