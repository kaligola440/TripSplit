import { ArrowDownLeft, ArrowUpRight, CheckCircle2, HandCoins, Scale } from "lucide-react";
import { SettlementForm } from "@/features/balances/settlement-form";
import {
  formatExactUnits,
  parseExactUnits,
  suggestSettlements,
  type BalanceParticipant,
} from "@/features/balances/balances";
import type { TripFinancials } from "@/features/balances/financial-data";
import { formatTripDate } from "@/features/trips/trip-shell";
import { formatPersonName } from "@/lib/person-name";

function amount(value: string, currency: string) {
  const units = parseExactUnits(value);
  if (units === null) throw new Error("Invalid financial amount.");
  return `${formatExactUnits(units)} ${currency}`;
}

function netAmount(value: string, currency: string) {
  const units = parseExactUnits(value);
  if (units === null) throw new Error("Invalid participant balance.");
  return `${units > 0n ? "+" : ""}${formatExactUnits(units)} ${currency}`;
}

function participantStatus(participant: BalanceParticipant) {
  const balance = parseExactUnits(participant.netBalance);
  if (balance === null) throw new Error("Invalid participant balance.");
  if (balance > 0n) return { text: "To receive", className: "bg-emerald-50 text-emerald-800", Icon: ArrowDownLeft };
  if (balance < 0n) return { text: "To pay", className: "bg-rose-50 text-rose-800", Icon: ArrowUpRight };
  return { text: "Settled", className: "bg-slate-100 text-slate-600", Icon: CheckCircle2 };
}

function total(values: string[]) {
  return values.reduce((sum, value) => {
    const units = parseExactUnits(value);
    if (units === null) throw new Error("Invalid financial amount.");
    return sum + units;
  }, 0n);
}

export function TripFinancialsPanel({
  tripId,
  currency,
  financials,
  settlementRecorded,
}: {
  tripId: string;
  currency: string;
  financials: TripFinancials;
  settlementRecorded: boolean;
}) {
  const { participants, settlements } = financials;
  const suggestions = suggestSettlements(participants);
  const totalPaid = total(participants.map((participant) => participant.paidAmount));
  const totalSettled = total(settlements.map((settlement) => settlement.amount));
  const totalOwed = participants.reduce((sum, participant) => {
    const balance = parseExactUnits(participant.netBalance);
    if (balance === null) throw new Error("Invalid participant balance.");
    return balance > 0n ? sum + balance : sum;
  }, 0n);

  return <section aria-labelledby="balances-heading" className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
    <div className="flex items-start gap-3">
      <Scale aria-hidden="true" size={21} className="mt-0.5 shrink-0 text-emerald-700" />
      <div><h2 id="balances-heading" className="text-lg font-semibold">Balances &amp; settlements</h2><p className="mt-1 text-sm text-slate-600">See who has paid, what each person owes, and how to settle up.</p></div>
    </div>
    {settlementRecorded ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Settlement recorded. Trip balances have been updated.</p> : null}

    <div className="mt-6 grid gap-3 sm:grid-cols-3">
      {[
        { label: "Total expenses paid", value: formatExactUnits(totalPaid) },
        { label: "Outstanding to receive", value: formatExactUnits(totalOwed) },
        { label: "Settlements recorded", value: formatExactUnits(totalSettled) },
      ].map(({ label, value }) => <div key={label} className="rounded-2xl bg-slate-50 p-4">
        <p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value} {currency}</p>
      </div>)}
    </div>

    <div className="mt-7">
      <h3 className="font-semibold">Participant balances</h3>
      {participants.length ? <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {participants.map((participant) => {
          const status = participantStatus(participant);
          const Icon = status.Icon;
          return <li key={participant.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><p className="break-words font-semibold">{formatPersonName(participant.name)}</p>{participant.email ? <p className="mt-1 break-all text-xs text-slate-500">{participant.email}</p> : null}
                {participant.status === "inactive" ? <p className="mt-1 text-xs text-slate-500">Former participant · historical balance retained</p> : null}
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}><Icon aria-hidden="true" size={14} />{status.text}</span>
            </div>
            <p className="mt-4 text-xl font-semibold tabular-nums">{netAmount(participant.netBalance, currency)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
              <div><dt className="text-slate-500">Paid</dt><dd className="mt-0.5 font-medium">{amount(participant.paidAmount, currency)}</dd></div>
              <div><dt className="text-slate-500">Share owed</dt><dd className="mt-0.5 font-medium">{amount(participant.owedAmount, currency)}</dd></div>
              <div><dt className="text-slate-500">Settlements paid</dt><dd className="mt-0.5 font-medium">{amount(participant.settlementsPaid, currency)}</dd></div>
              <div><dt className="text-slate-500">Settlements received</dt><dd className="mt-0.5 font-medium">{amount(participant.settlementsReceived, currency)}</dd></div>
            </dl>
          </li>;
        })}
      </ul> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No participants are available for this trip.</p>}
    </div>

    <div className="mt-7 border-t border-slate-100 pt-6">
      <div className="flex items-center gap-2"><HandCoins aria-hidden="true" size={18} className="text-emerald-700" /><h3 className="font-semibold">Suggested settlements</h3></div>
      {suggestions.length ? <ol className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
        {suggestions.map((suggestion, index) => <li key={`${suggestion.fromParticipantId}-${suggestion.toParticipantId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <p className="min-w-0 break-words"><span className="font-semibold">{formatPersonName(suggestion.fromName)}</span><span className="text-slate-500"> pays </span><span className="font-semibold">{formatPersonName(suggestion.toName)}</span></p>
          <p className="font-semibold tabular-nums">{amount(suggestion.amount, currency)}</p>
        </li>)}
      </ol> : <p className="mt-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">Everyone is settled. There are no transfers to suggest.</p>}
      <SettlementForm tripId={tripId} currency={currency} today={new Date().toISOString().slice(0, 10)} participants={participants} />
    </div>

    <div className="mt-7 border-t border-slate-100 pt-6">
      <h3 className="font-semibold">Settlement history</h3>
      {settlements.length ? <ol className="mt-3 divide-y divide-slate-100">
        {settlements.map((settlement) => <li key={settlement.id} className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><p className="break-words text-sm"><span className="font-semibold">{formatPersonName(settlement.fromName)}</span><span className="text-slate-500"> paid </span><span className="font-semibold">{formatPersonName(settlement.toName)}</span></p><p className="mt-1 text-xs text-slate-500">{formatTripDate(settlement.paymentDate)}</p></div>
            <p className="font-semibold tabular-nums">{amount(settlement.amount, settlement.currency)}</p>
          </div>
          {settlement.notes ? <details className="mt-2 text-sm"><summary className="w-fit cursor-pointer font-medium text-emerald-800 hover:underline">View details</summary><p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-slate-600">{settlement.notes}</p></details> : <p className="mt-2 text-xs text-slate-500">No note for this settlement.</p>}
        </li>)}
      </ol> : <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">No settlements recorded yet.</p>}
      <p className="mt-3 text-xs text-slate-500">Recorded settlements are kept as financial history and cannot be edited or deleted.</p>
    </div>
  </section>;
}
