import { TripShell } from "@/features/trips/trip-shell";

export default function TripLoading() {
  return (
    <TripShell>
      <section aria-busy="true" className="py-10 sm:py-16">
        <p role="status" className="sr-only">Loading trip details…</p>
        <div aria-hidden="true" className="h-9 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div aria-hidden="true" className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          <div className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        </div>
        <div aria-hidden="true" className="mt-8 h-64 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </section>
    </TripShell>
  );
}
