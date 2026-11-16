import { TripShell } from "@/features/trips/trip-shell";

export default function TripsLoading() {
  return (
    <TripShell>
      <section aria-busy="true" className="py-10 sm:py-16">
        <p role="status" className="sr-only">Loading your trips…</p>
        <div aria-hidden="true" className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div aria-hidden="true" className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />)}
        </div>
      </section>
    </TripShell>
  );
}
