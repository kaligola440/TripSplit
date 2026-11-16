import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ArrowRight, CalendarDays, CircleCheck, CircleDollarSign, Luggage, Plus, UsersRound } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { formatTripDate, TripShell } from "@/features/trips/trip-shell";
import { listTrips } from "@/features/trips/queries";
import { formatTripAmount, formatTripBalance, getTripScheduleStatus, type TripScheduleStatus } from "@/features/trips/dashboard";
import { parseExactUnits } from "@/features/balances/balances";
import type { createClient } from "@/lib/supabase/server";

const sections: { status: TripScheduleStatus; title: string; description: string }[] = [
  { status: "upcoming", title: "Upcoming", description: "Trips that have not started yet." },
  { status: "active", title: "In progress", description: "Trips happening now or without a past end date." },
  { status: "completed", title: "Completed", description: "Trips whose end date has passed." },
];

async function TripList({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const trips = await listTrips(supabase);
  if (trips.length === 0) {
    return (
      <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <Luggage aria-hidden="true" size={32} className="mx-auto text-emerald-700" />
        <h2 className="mt-5 text-lg font-semibold">Your next adventure starts here</h2>
        <p className="mt-2 text-sm text-slate-600">Create a trip to bring your plans together.</p>
        <Link href="/trips/new" className="mt-6 inline-block font-semibold text-emerald-800 hover:underline">Create your first trip →</Link>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const groupedTrips = new Map(
    sections.map(({ status }) => [
      status,
      trips
        .filter((trip) => getTripScheduleStatus(trip, today) === status)
        .sort((a, b) => a.start_date.localeCompare(b.start_date)),
    ]),
  );
  const totals = {
    trips: trips.length,
    participants: trips.reduce((sum, trip) => sum + trip.participant_count, 0),
    expenses: trips.filter((trip) => {
      const units = parseExactUnits(trip.total_expenses);
      if (units === null) throw new Error("Invalid expense total returned for a trip.");
      return units > 0n;
    }).length,
  };

  return (
    <div className="mt-8 space-y-10">
      <dl aria-label="Trip overview" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Luggage aria-hidden="true" size={18} />} label="Trips" value={totals.trips} />
        <SummaryCard icon={<UsersRound aria-hidden="true" size={18} />} label="Active participant spots" value={totals.participants} />
        <SummaryCard icon={<CircleDollarSign aria-hidden="true" size={18} />} label="Trips with expenses" value={totals.expenses} />
      </dl>
      {sections.map(({ status, title, description }) => {
        const statusTrips = groupedTrips.get(status) ?? [];
        if (statusTrips.length === 0) return null;
        return (
          <section key={status} aria-labelledby={`${status}-trips-heading`}>
            <div className="mb-4">
              <h2 id={`${status}-trips-heading`} className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {statusTrips.map((trip) => {
                const balance = formatTripBalance(trip.net_balance, trip.currency);
                return (
                  <article key={trip.id} className="flex min-w-0 flex-col rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.2)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800"><Luggage aria-hidden="true" size={21} /></div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{status === "active" ? "In progress" : status === "upcoming" ? "Upcoming" : "Completed"}</span>
                    </div>
                    <h3 className="mt-5 break-words text-lg font-semibold">{trip.name}</h3>
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      <CalendarDays aria-hidden="true" size={15} />
                      <span>{formatTripDate(trip.start_date)}{trip.end_date ? ` – ${formatTripDate(trip.end_date)}` : ""}</span>
                    </p>
                    <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-slate-600"><UsersRound aria-hidden="true" size={14} /> Participants</dt>
                        <dd className="mt-1 font-semibold">{trip.participant_count}</dd>
                      </div>
                      <div>
                        <dt className="flex items-center gap-1.5 text-xs text-slate-600"><CircleDollarSign aria-hidden="true" size={14} /> Total expenses</dt>
                        <dd className="mt-1 break-words font-semibold">{formatTripAmount(trip.total_expenses, trip.currency)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="flex items-center gap-1.5 text-xs text-slate-600"><CircleCheck aria-hidden="true" size={14} /> Your balance</dt>
                        <dd className="mt-1 break-words font-semibold">{balance.label}: {balance.amount}</dd>
                      </div>
                    </dl>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6">
                      <Link href={`/trips/${trip.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                        View trip <ArrowRight aria-hidden="true" size={16} />
                      </Link>
                      <Link href={`/trips/${trip.id}/expenses/new`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
                        Add expense
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
      <dt className="flex items-center gap-2 text-sm text-slate-600">{icon}{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
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
            <p className="mt-3 text-sm text-slate-600">A clear view of trip activity and where you stand.</p>
          </div>
          <Link href="/trips/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900">
            <Plus aria-hidden="true" size={18} /> Create trip
          </Link>
        </div>
        <Suspense fallback={<p role="status" aria-live="polite" className="mt-10 text-sm text-slate-600">Loading your trips…</p>}>
          <TripList supabase={supabase} />
        </Suspense>
      </section>
    </TripShell>
  );
}
