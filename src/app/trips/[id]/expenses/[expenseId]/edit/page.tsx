import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { TripShell } from "@/features/trips/trip-shell";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { parseExpenseDetail } from "@/features/expenses/expense-data";
import { ExpenseActions } from "@/features/expenses/expense-actions";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const [{ supabase, userId }, { id: tripId, expenseId }] = await Promise.all([requireAuthenticatedUser(), params]);
  if (!isTripId(tripId) || !isTripId(expenseId)) notFound();
  const [{ data: trip, error: tripError }, { data, error }, { data: participants, error: participantError }, { data: settlements, error: settlementError }] = await Promise.all([
    supabase.from("trips").select("id, name, currency, created_by").eq("id", tripId).maybeSingle(),
    supabase.rpc("get_expense_detail", { p_expense_id: expenseId }),
    supabase.from("trip_participants").select("id, display_name").eq("trip_id", tripId).eq("status", "active").order("display_name"),
    supabase.from("settlements").select("id").eq("trip_id", tripId).limit(1),
  ]);
  if (tripError || error || participantError || settlementError) throw new Error("Unable to load expense editor.");
  if (!trip) notFound();
  const expense = parseExpenseDetail(data);
  if (!expense || expense.trip_id !== tripId) notFound();
  const canEdit = expense.created_by === userId || trip.created_by === userId;
  if (!canEdit) notFound();
  const settlementsExist = settlements.length > 0;
  return <TripShell><section className="mx-auto max-w-2xl py-10 sm:py-16">
    <Link href={`/trips/${tripId}/expenses/${expenseId}`} className="text-sm font-semibold text-emerald-800 hover:underline">← Back to expense</Link>
    <h1 className="mt-5 text-3xl font-semibold tracking-tight">Edit expense</h1>
    <p className="mt-2 text-sm text-slate-600">Update the payment details and split.</p>
    <div className="mt-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9"><ExpenseForm tripId={tripId} tripCurrency={trip.currency} participants={participants} today={new Date().toISOString().slice(0, 10)} expense={expense} disabled={settlementsExist} /></div>
    <div className="mt-5"><ExpenseActions tripId={tripId} expenseId={expenseId} canEdit={canEdit} settlementsExist={settlementsExist} /></div>
  </section></TripShell>;
}
