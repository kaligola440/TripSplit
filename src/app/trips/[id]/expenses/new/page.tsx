import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { TripShell } from "@/features/trips/trip-shell";
import { ExpenseForm } from "@/features/expenses/expense-form";

export default async function NewExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase }, { id }] = await Promise.all([requireAuthenticatedUser(), params]);
  if (!isTripId(id)) notFound();
  const [{ data: trip, error: tripError }, { data: participants, error: participantError }] = await Promise.all([
    supabase.from("trips").select("id, name, currency").eq("id", id).maybeSingle(),
    supabase.from("trip_participants").select("id, display_name").eq("trip_id", id).eq("status", "active").order("display_name"),
  ]);
  if (tripError || participantError) throw new Error("Unable to load trip expense form.");
  if (!trip) notFound();
  return <TripShell><section className="mx-auto max-w-2xl py-10 sm:py-16">
    <Link href={`/trips/${id}`} className="text-sm font-semibold text-emerald-800 hover:underline">← Back to {trip.name}</Link>
    <h1 className="mt-5 text-3xl font-semibold tracking-tight">Add an expense</h1>
    <p className="mt-2 text-sm text-slate-600">Record what was paid and how the trip shares it.</p>
    <div className="mt-7 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9">
      {participants.length ? <ExpenseForm tripId={id} tripCurrency={trip.currency} participants={participants} today={new Date().toISOString().slice(0, 10)} /> : <p role="alert" className="text-sm text-rose-800">Add an active participant to this trip before creating an expense.</p>}
    </div>
  </section></TripShell>;
}
