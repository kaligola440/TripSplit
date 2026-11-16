import Link from "next/link";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { TripForm } from "@/features/trips/trip-form";
import { TripShell } from "@/features/trips/trip-shell";

export default async function NewTripPage() {
  await requireAuthenticatedUser();
  return (
    <TripShell>
      <section className="mx-auto max-w-2xl py-10 sm:py-16">
        <Link href="/trips" className="text-sm font-semibold text-emerald-800 hover:underline">← Back to trips</Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Create a trip</h1>
        <p className="mt-3 text-sm text-slate-600">Start with the essentials. You can edit these details later.</p>
        <div className="mt-8 rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-9"><TripForm /></div>
      </section>
    </TripShell>
  );
}
