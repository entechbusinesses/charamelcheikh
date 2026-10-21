import { API_BASE_URL } from "@/apis/api";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Shift } from "@/contexts/ShiftContext";
import { formatDH, formatDuration } from "./utils";

/** 88mm ticket of a shift (closing ticket, or current state if still open) */
export default function ShiftTicket({ shift }: { shift: Shift }) {
  const { summary } = shift;
  const closedAt = shift.closed_at ?? new Date().toISOString();
  const date = (d: string) => format(new Date(d), "P à p", { locale: fr });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <div className="w-[88mm] bg-white p-4 text-sm text-black">
      <div className="mb-4 text-center">
        {shift.local.logo_url && (
          <img
            src={`${API_BASE_URL}${shift.local.logo_url}`}
            className="mx-auto mb-3 h-20 w-max rounded-md object-contain grayscale contrast-200 filter"
          />
        )}
        <p className="text-2xl font-bold">{shift.local.name}</p>
        <p className="underline">
          {shift.closed_at ? "Ticket de clôture" : "Situation (shift en cours)"}{" "}
          — Shift #{shift.id}
        </p>
      </div>

      <div className="space-y-1">
        <Row label="Caissier :" value={shift.user.name} />
        <Row label="Ouverture :" value={date(shift.opened_at)} />
        <Row
          label="Clôture :"
          value={shift.closed_at ? date(shift.closed_at) : "En cours"}
        />
        <Row label="Durée :" value={formatDuration(shift.opened_at, closedAt)} />
      </div>

      <hr className="my-3 border-dashed border-black" />

      <div className="space-y-1">
        <Row label="Nombre de ventes :" value={String(summary.count)} />
        <Row label="Services :" value={formatDH(summary.services)} />
        {summary.frais > 0 && (
          <Row label="  dont frais :" value={formatDH(summary.frais)} />
        )}
        <Row label="Produits :" value={formatDH(summary.products)} />
        <Row label="Total ventes :" value={formatDH(summary.total)} />
      </div>

      <hr className="my-3 border-dashed border-black" />

      <div className="space-y-1">
        <Row
          label={`Espèces (${summary.methods.CASH + summary.methods.MIXTE}) :`}
          value={formatDH(summary.cash)}
        />
        <Row
          label={`TPE (${summary.methods.TPE + summary.methods.MIXTE}) :`}
          value={formatDH(summary.tpe)}
        />
        {summary.methods.MIXTE > 0 && (
          <Row label="dont paiements mixtes :" value={String(summary.methods.MIXTE)} />
        )}
      </div>

      <hr className="my-3 border-dashed border-black" />

      <div className="space-y-1">
        <Row label="Fond de caisse :" value={formatDH(shift.fond_caisse)} />
        <Row label="+ Espèces :" value={formatDH(summary.cash)} />
        <div className="flex justify-between gap-2 border-t border-black pt-1 text-base font-bold">
          <span>Caisse attendue :</span>
          <span>{formatDH(shift.balance)}</span>
        </div>
      </div>

      <div className="mt-8 flex justify-between text-xs">
        <span>Signature caissier</span>
        <span>Signature responsable</span>
      </div>
      <div className="h-12" />

      <p className="text-center text-xs">
        Imprimé le {format(new Date(), "P à p", { locale: fr })}
      </p>
    </div>
  );
}
