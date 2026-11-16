import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarDays, Luggage, Plus } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { formatTripDate, TripShell } from "@/features/trips/trip-shell";
import { listTrips } from "@/features/trips/queries";
import type { createClient } from "@/lib/supabase/server";

async function TripList({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const trips = await listTrips(supabase);
  return trips.length === 0 ? (
    <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
      <Luggage aria-hidden="true" size={32} className="mx-auto text-emerald-700" />
      <h2 className="mt-5 text-lg font-semibold">Your next adventure starts here</h2>
      <p className="mt-2 text-sm text-slate-600">Create a trip to bring your plans together.</p>
      <Link href="/trips/new" className="mt-6 inline-block font-semibold text-emerald-800 hover:underline">Create your first trip →</Link>
    </div>
  ) : (
    <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <Link key={trip.id} href={`/trips/${trip.id}`} className="group flex min-h-56 flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.2)] transition hover:border-emerald-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
          <div className="flex items-start justify-between gap-4">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><Luggage aria-hidden="true" size={21} /></div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{trip.currency}</span>
          </div>
          <h2 className="mt-5 break-words text-lg font-semibold">{trip.name}</h2>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><CalendarDays aria-hidden="true" size={15} />{formatTripDate(trip.start_date)}{trip.end_date ? ` – ${formatTripDate(trip.end_date)}` : ""}</p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-semibold text-emerald-800">View trip <ArrowRight aria-hidden="true" size={16} className="transition group-hover:translate-x-1" /></span>
        </Link>
      ))}
    </div>
  );
}

export default async function TripsPage() {
  const { supabase } = await requireAuthenticatedUser();
  return (
    <TripShell>
      <section className="py-10 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-emerald-800">YOUR ADVENTURES</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your trips</h1>
            <p className="mt-3 text-sm text-slate-600">All your shared trips, in one place.</p>
          </div>
          <Link href="/trips/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">
            <Plus aria-hidden="true" size={18} /> Create trip
          </Link>
        </div>
        <Suspense fallback={<p role="status" className="mt-10 text-sm text-slate-600">Loading your trips…</p>}>
          <TripList supabase={supabase} />
        </Suspense>
      </section>
    </TripShell>
  );
}
