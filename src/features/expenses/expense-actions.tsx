"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { deleteExpense } from "@/features/expenses/actions";

function DeleteButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60">{pending ? "Deleting…" : "Confirm deletion"}</button>;
}

export function ExpenseActions({
  tripId,
  expenseId,
  canEdit,
  settlementsExist,
}: {
  tripId: string;
  expenseId: string;
  canEdit: boolean;
  settlementsExist: boolean;
}) {
  const [state, action] = useActionState(deleteExpense.bind(null, tripId, expenseId), initialAuthFormState);
  if (!canEdit) return null;
  return <div className="flex flex-wrap items-start gap-3">
    {settlementsExist ? <p className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This trip has settlements. Expense changes and deletion are locked to preserve financial history.</p> : <>
      <Link href={`/trips/${tripId}/expenses/${expenseId}/edit`} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-emerald-300">Edit expense</Link>
      <details className="text-sm"><summary className="cursor-pointer rounded-xl border border-rose-200 px-4 py-2.5 font-semibold text-rose-800">Delete expense</summary>
        <div className="mt-2 space-y-3 rounded-xl border border-rose-100 bg-white p-4">
          <p className="text-sm text-slate-600">Permanently delete this expense and its shares? This cannot be undone.</p>
          <FormFeedback state={state} />
          <form action={action}><DeleteButton /></form>
        </div>
      </details>
    </>}
  </div>;
}
