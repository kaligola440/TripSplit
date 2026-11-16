import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Coins, ReceiptText } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { TripShell, formatTripDate } from "@/features/trips/trip-shell";
import { ExpenseActions } from "@/features/expenses/expense-actions";
import { formatDatabaseAmount } from "@/features/expenses/money";
import { parseExpenseDetail } from "@/features/expenses/expense-data";

export default async function ExpenseDetailPage({ params, searchParams }: {
  params: Promise<{ id: string; expenseId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ supabase, userId }, { id: tripId, expenseId }, query] = await Promise.all([requireAuthenticatedUser(), params, searchParams]);
  if (!isTripId(tripId) || !isTripId(expenseId)) notFound();
  const [{ data: trip, error: tripError }, { data, error }, { data: settlements, error: settlementError }] = await Promise.all([
    supabase.from("trips").select("id, name, created_by").eq("id", tripId).maybeSingle(),
    supabase.rpc("get_expense_detail", { p_expense_id: expenseId }),
    supabase.from("settlements").select("id").eq("trip_id", tripId).limit(1),
  ]);
  if (tripError || error || settlementError) throw new Error("Unable to load expense details.");
  if (!trip) notFound();
  const expense = parseExpenseDetail(data);
  if (!expense || expense.trip_id !== tripId) notFound();
  const canEdit = expense.created_by === userId || trip.created_by === userId;
  const settlementsExist = settlements.length > 0;
  const method = expense.shares[0]?.share_type;
  return <TripShell><section className="mx-auto max-w-4xl py-10 sm:py-16">
    <Link href={`/trips/${tripId}`} className="text-sm font-semibold text-emerald-800 hover:underline">← Back to {trip.name}</Link>
    {query.created === "1" ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Expense created.</p> : null}
    <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-sm font-semibold text-emerald-800">{expense.category.toUpperCase()}</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight">{expense.description}</h1></div>
      <div className="text-right"><p className="text-2xl font-semibold tabular-nums">{formatDatabaseAmount(expense.amount)} {expense.currency}</p><p className="mt-1 text-sm text-slate-500">Total expense</p></div>
    </div>
    <div className="mt-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <div className="grid gap-5 text-sm text-slate-600 sm:grid-cols-3">
        <p className="flex items-center gap-2"><CalendarDays aria-hidden="true" size={17} className="text-emerald-700" />{formatTripDate(expense.expense_date)}</p>
        <p className="flex items-center gap-2"><Coins aria-hidden="true" size={17} className="text-emerald-700" />Paid by {expense.payer_name}</p>
        <p className="flex items-center gap-2"><ReceiptText aria-hidden="true" size={17} className="text-emerald-700" />{method ? `${method.charAt(0).toUpperCase()}${method.slice(1)} split` : "No split"}</p>
      </div>
      {expense.notes ? <div className="mt-6 border-t border-slate-100 pt-5"><h2 className="text-sm font-semibold">Notes</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{expense.notes}</p></div> : null}
    </div>
    <div className="mt-6 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <h2 className="text-lg font-semibold">Share breakdown</h2>
      <ul className="mt-4 divide-y divide-slate-100">{expense.shares.map((share) => <li key={share.participant_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div><p className="font-medium">{share.display_name}</p>{share.share_type === "percentage" && share.share_percentage ? <p className="mt-1 text-xs text-slate-500">{formatDatabaseAmount(share.share_percentage)}%</p> : null}</div>
        <p className="font-semibold tabular-nums">{formatDatabaseAmount(share.share_amount)} {expense.currency}</p>
      </li>)}</ul>
    </div>
    <div className="mt-6"><ExpenseActions tripId={tripId} expenseId={expenseId} canEdit={canEdit} settlementsExist={settlementsExist} /></div>
  </section></TripShell>;
}
