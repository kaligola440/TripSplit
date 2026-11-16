"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { recordTripSettlement } from "@/features/balances/actions";
import { formatExactUnits, parseExactUnits } from "@/features/balances/balances";
import type { BalanceParticipant } from "@/features/balances/balances";
import { formatPersonName } from "@/lib/person-name";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60">{pending ? "Recording…" : "Record settlement"}</button>;
}

function balanceLabel(value: string, negate = false) {
  const units = parseExactUnits(value);
  if (units === null) throw new Error("Invalid participant balance.");
  return formatExactUnits(negate ? -units : units);
}

export function SettlementForm({
  tripId,
  currency,
  today,
  participants,
}: {
  tripId: string;
  currency: string;
  today: string;
  participants: BalanceParticipant[];
}) {
  const payers = participants.filter((participant) => {
    const balance = parseExactUnits(participant.netBalance);
    return balance !== null && balance < 0n;
  });
  const recipients = participants.filter((participant) => {
    const balance = parseExactUnits(participant.netBalance);
    return balance !== null && balance > 0n;
  });
  const [state, action] = useActionState(
    recordTripSettlement.bind(null, tripId),
    initialAuthFormState,
  );
  if (!payers.length || !recipients.length) return null;

  return <form action={action} className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
    <h3 className="font-semibold text-slate-900">Record a payment</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-medium text-slate-700">Payer
        <select name="fromParticipantId" required defaultValue="" aria-describedby={state.fieldErrors?.fromParticipantId ? "settlement-payer-error" : undefined} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="" disabled>Select who paid</option>
          {payers.map((participant) => <option key={participant.id} value={participant.id}>{formatPersonName(participant.name)} · owes {balanceLabel(participant.netBalance, true)} {currency}</option>)}
        </select>
        {state.fieldErrors?.fromParticipantId ? <span id="settlement-payer-error" className="mt-1 block text-xs text-rose-700">{state.fieldErrors.fromParticipantId}</span> : null}
      </label>
      <label className="block text-sm font-medium text-slate-700">Recipient
        <select name="toParticipantId" required defaultValue="" aria-describedby={state.fieldErrors?.toParticipantId ? "settlement-recipient-error" : undefined} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">
          <option value="" disabled>Select who received it</option>
          {recipients.map((participant) => <option key={participant.id} value={participant.id}>{formatPersonName(participant.name)} · is owed {balanceLabel(participant.netBalance)} {currency}</option>)}
        </select>
        {state.fieldErrors?.toParticipantId ? <span id="settlement-recipient-error" className="mt-1 block text-xs text-rose-700">{state.fieldErrors.toParticipantId}</span> : null}
      </label>
      <label className="block text-sm font-medium text-slate-700">Amount ({currency})
        <input name="amount" required inputMode="decimal" autoComplete="off" placeholder="0.00" aria-describedby={state.fieldErrors?.amount ? "settlement-amount-error" : undefined} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        {state.fieldErrors?.amount ? <span id="settlement-amount-error" className="mt-1 block text-xs text-rose-700">{state.fieldErrors.amount}</span> : null}
      </label>
      <label className="block text-sm font-medium text-slate-700">Payment date
        <input name="paymentDate" type="date" required defaultValue={today} aria-describedby={state.fieldErrors?.paymentDate ? "settlement-date-error" : undefined} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
        {state.fieldErrors?.paymentDate ? <span id="settlement-date-error" className="mt-1 block text-xs text-rose-700">{state.fieldErrors.paymentDate}</span> : null}
      </label>
    </div>
    <label className="block text-sm font-medium text-slate-700">Note (optional)
      <textarea name="notes" rows={2} maxLength={5000} aria-describedby={state.fieldErrors?.notes ? "settlement-notes-error" : undefined} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" />
      {state.fieldErrors?.notes ? <span id="settlement-notes-error" className="mt-1 block text-xs text-rose-700">{state.fieldErrors.notes}</span> : null}
    </label>
    <FormFeedback state={state} />
    <SubmitButton />
  </form>;
}
