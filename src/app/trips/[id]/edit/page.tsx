import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { TripForm } from "@/features/trips/trip-form";
import { TripShell } from "@/features/trips/trip-shell";

export default async function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ supabase, userId }, { id }] = await Promise.all([requireAuthenticatedUser(), params]);
  if (!isTripId(id)) notFound();
  const { data: trip, error } = await supabase.from("trips").select("*").eq("id", id).eq("created_by", userId).maybeSingle();
  if (error) throw new Error("Unable to load trip.");
  if (!trip) notFound();
  const { data: participant, error: participantError } = await supabase.from("trip_participants").select("id").eq("trip_id", id).eq("user_id", userId).eq("status", "active").maybeSingle();
  if (participantError) throw new Error("Unable to verify trip membership.");
  if (!participant) notFound();

  return (
    <TripShell>
      <section className="mx-auto max-w-2xl py-10 sm:py-16">
        <Link href={`/trips/${trip.id}`} className="text-sm font-semibold text-emerald-800 hover:underline">← Back to trip</Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Edit trip</h1>
        <p className="mt-3 text-sm text-slate-600">Update the details for {trip.name}.</p>
        <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9"><TripForm trip={trip} /></div>
      </section>
    </TripShell>
  );
}
