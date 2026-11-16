"use client";

import { useActionState, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { createExpense, updateExpense } from "@/features/expenses/actions";
import { calculateShares, type SplitMethod } from "@/features/expenses/splits";
import { formatPersonName } from "@/lib/person-name";

export type ExpenseParticipant = { id: string; display_name: string };
export type ExpenseInitialData = {
  id: string;
  description: string;
  amount: string;
  expense_date: string;
  category: string;
  paid_by_participant_id: string;
  notes: string | null;
  shares: { participant_id: string; share_amount: string; share_type: SplitMethod; share_percentage: string | null }[];
};

const fieldClass = "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 aria-[invalid=true]:border-rose-400";
const categories = ["accommodation", "activities", "food", "groceries", "transport", "other"];

function Submit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="inline-flex items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{pending ? "Saving…" : children}</button>;
}

export function ExpenseForm({
  tripId,
  tripCurrency,
  participants,
  today,
  expense,
  disabled = false,
}: {
  tripId: string;
  tripCurrency: string;
  participants: ExpenseParticipant[];
  today: string;
  expense?: ExpenseInitialData;
  disabled?: boolean;
}) {
  const action = expense ? updateExpense.bind(null, tripId, expense.id) : createExpense;
  const [state, formAction] = useActionState(action, initialAuthFormState);
  const initialMethod = expense?.shares[0]?.share_type ?? "equal";
  const [method, setMethod] = useState<SplitMethod>(initialMethod);
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [selected, setSelected] = useState<string[]>(expense?.shares.map((share) => share.participant_id) ?? participants.map((participant) => participant.id));
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries((expense?.shares ?? []).map((share) => [
    share.participant_id,
    share.share_type === "percentage" ? share.share_percentage ?? "" : share.share_amount,
  ])));
  const errors = state.fieldErrors ?? {};
  const selectedParticipants = participants.filter((participant) => selected.includes(participant.id));
  const split = useMemo(() => calculateShares(amount, selectedParticipants.map(({ id, display_name }) => ({ id, name: display_name })), method, values), [amount, selectedParticipants, method, values]);
  const preview = split.success ? new Map(split.shares.map((share) => [share.participant_id, share.share_amount])) : null;

  function toggleParticipant(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return <form action={formAction} className="space-y-5">
    <input type="hidden" name="tripId" value={tripId} />
    <FormFeedback state={state} />
    <FormField id="expense-description" label="Description" error={errors.description}>
      <input id="expense-description" name="description" required maxLength={240} defaultValue={expense?.description} placeholder="Dinner, train tickets…" aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "expense-description-error" : undefined} className={fieldClass} />
    </FormField>
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id="expense-amount" label={`Amount (${tripCurrency})`} error={errors.amount}>
        <input id="expense-amount" name="amount" type="text" inputMode="decimal" autoComplete="off" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" aria-invalid={Boolean(errors.amount)} aria-describedby={errors.amount ? "expense-amount-error" : "amount-help"} className={fieldClass} />
        <p id="amount-help" className="mt-1 text-xs text-slate-500">Up to six decimal places. No currency conversion.</p>
      </FormField>
      <FormField id="expense-date" label="Date" error={errors.expenseDate}>
        <input id="expense-date" name="expenseDate" type="date" required defaultValue={expense?.expense_date ?? today} aria-invalid={Boolean(errors.expenseDate)} aria-describedby={errors.expenseDate ? "expense-date-error" : undefined} className={fieldClass} />
      </FormField>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id="expense-category" label="Category" error={errors.category}>
        <select id="expense-category" name="category" defaultValue={expense?.category ?? "other"} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "expense-category-error" : undefined} className={fieldClass}>{categories.map((category) => <option key={category} value={category}>{category.charAt(0).toUpperCase() + category.slice(1)}</option>)}</select>
      </FormField>
      <FormField id="expense-payer" label="Paid by" error={errors.payerId}>
        <select id="expense-payer" name="payerId" defaultValue={expense?.paid_by_participant_id ?? ""} required aria-invalid={Boolean(errors.payerId)} aria-describedby={errors.payerId ? "expense-payer-error" : undefined} className={fieldClass}><option value="" disabled>Select a participant</option>{participants.map((participant) => <option key={participant.id} value={participant.id}>{formatPersonName(participant.display_name)}</option>)}</select>
      </FormField>
    </div>
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">Split between</legend>
      {errors.participants ? <p role="alert" className="text-xs text-rose-700">{errors.participants}</p> : null}
      {participants.length ? participants.map((participant) => <label key={participant.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-sm">
        <input type="checkbox" name="participantIds" value={participant.id} checked={selected.includes(participant.id)} onChange={() => toggleParticipant(participant.id)} className="size-4 accent-emerald-800" />
        <span className="min-w-0 flex-1 break-words font-medium">{formatPersonName(participant.display_name)}</span>
        {selected.includes(participant.id) && preview ? <span className="shrink-0 text-slate-600">{preview.get(participant.id)} {tripCurrency}</span> : null}
      </label>) : <p className="text-sm text-slate-600">No active participants are available.</p>}
    </fieldset>
    <FormField id="split-method" label="Split method" error={errors.splitMethod}>
      <select id="split-method" name="splitMethod" value={method} onChange={(event) => setMethod(event.target.value as SplitMethod)} className={fieldClass}>
        <option value="equal">Split equally</option><option value="custom">Custom amounts</option><option value="percentage">By percentage</option>
      </select>
    </FormField>
    {method !== "equal" ? <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-slate-700">{method === "custom" ? "Share amount" : "Share percentage"}</legend>
      {errors.shares ? <p role="alert" className="text-xs text-rose-700">{errors.shares}</p> : null}
      {selectedParticipants.map((participant) => <FormField key={participant.id} id={`share-${participant.id}`} label={formatPersonName(participant.display_name)} error={errors[`share-${participant.id}`]}>
        <div className="relative"><input id={`share-${participant.id}`} name={method === "custom" ? `amount-${participant.id}` : `percentage-${participant.id}`} type="text" inputMode="decimal" autoComplete="off" value={values[participant.id] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [participant.id]: event.target.value }))} placeholder="0" aria-invalid={Boolean(errors[`share-${participant.id}`])} className={`${fieldClass} pr-16`} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-500">{method === "custom" ? tripCurrency : "%"}</span></div>
        {method === "percentage" && preview ? <p className="mt-1 text-xs text-slate-500">Preview: {preview.get(participant.id)} {tripCurrency}</p> : null}
      </FormField>)}
    </fieldset> : null}
    {!split.success ? <p role="status" className="text-xs text-slate-500">{split.message}</p> : <p role="status" className="text-xs text-emerald-800">Shares add up exactly to {amount} {tripCurrency}.</p>}
    <FormField id="expense-notes" label="Notes (optional)" error={errors.notes}>
      <textarea id="expense-notes" name="notes" rows={3} maxLength={5000} defaultValue={expense?.notes ?? ""} aria-invalid={Boolean(errors.notes)} aria-describedby={errors.notes ? "expense-notes-error" : undefined} className={fieldClass} />
    </FormField>
    {disabled ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This trip has settlements. Expense changes are locked to preserve financial history.</p> : <Submit>{expense ? "Save expense" : "Add expense"}</Submit>}
  </form>;
}
