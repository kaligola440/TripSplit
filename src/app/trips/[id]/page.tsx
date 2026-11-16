import Link from "next/link";
import { CalendarDays, Coins, Pencil, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { formatTripDate, TripShell } from "@/features/trips/trip-shell";

export default async function TripDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const [{ supabase, userId }, { id }, query] = await Promise.all([requireAuthenticatedUser(), params, searchParams]);
  if (!isTripId(id)) notFound();
  const { data: trip, error } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load trip.");
  if (!trip) notFound();
  const { data: participants, error: participantError } = await supabase.from("trip_participants")
    .select("id, user_id, display_name, role, status").eq("trip_id", id).order("created_at");
  if (participantError) throw new Error("Unable to load trip participants.");
  const owner = participants.find((participant) => participant.role === "owner");
  const canEdit = trip.created_by === userId && participants.some((participant) => participant.user_id === userId && participant.status === "active");

  return (
    <TripShell>
      <section className="py-10 sm:py-16">
        <Link href="/trips" className="text-sm font-semibold text-emerald-800 hover:underline">← Back to trips</Link>
        {query.created === "1" ? <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Your trip has been created.</p> : null}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-5">
          <div><p className="text-sm font-semibold text-emerald-800">TRIP DETAILS</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{trip.name}</h1></div>
          {canEdit ? <Link href={`/trips/${trip.id}/edit`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-300"><Pencil aria-hidden="true" size={16} /> Edit trip</Link> : null}
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold">Overview</h2>
              <div className="mt-5 grid gap-5 text-sm text-slate-600 sm:grid-cols-2">
                <div className="flex gap-3"><CalendarDays aria-hidden="true" size={19} className="shrink-0 text-emerald-700" /><div><p className="font-medium text-slate-900">Dates</p><p className="mt-1">{formatTripDate(trip.start_date)}{trip.end_date ? ` – ${formatTripDate(trip.end_date)}` : " · No end date"}</p></div></div>
                <div className="flex gap-3"><Coins aria-hidden="true" size={19} className="shrink-0 text-emerald-700" /><div><p className="font-medium text-slate-900">Currency</p><p className="mt-1">{trip.currency}</p></div></div>
              </div>
              <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-medium">Description</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{trip.description || "No description added yet."}</p></div>
            </div>
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
              <h2 className="text-lg font-semibold">More to come</h2>
              <p className="mt-2 text-sm text-slate-600">These trip tools are not available yet.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">{["Participant management", "Expenses", "Balances", "Settlements"].map((item) => <div key={item} className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-500">{item} · Coming later</div>)}</div>
            </div>
          </div>
          <div className="h-fit rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2"><UsersRound aria-hidden="true" size={20} className="text-emerald-700" /><h2 className="text-lg font-semibold">Participants</h2></div>
            <p className="mt-3 text-sm text-slate-600">Created by {owner?.display_name ?? (trip.created_by === userId ? "you" : "a trip member")}.</p>
            {participants.length ? <ul className="mt-5 divide-y divide-slate-100">{participants.map((participant) => <li key={participant.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="break-words font-medium">{participant.display_name}</span><span className="shrink-0 text-xs capitalize text-slate-500">{participant.role} · {participant.status}</span></li>)}</ul> : <p className="mt-5 text-sm text-slate-500">Participant details are unavailable for this account.</p>}
          </div>
        </div>
      </section>
    </TripShell>
  );
}
