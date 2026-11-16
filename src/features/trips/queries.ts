import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type TripSummary = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  currency: string;
};

export async function listTrips(supabase: SupabaseClient): Promise<TripSummary[]> {
  const pageSize = 100;
  const trips: TripSummary[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("trips")
      .select("id, name, start_date, end_date, currency")
      .order("start_date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load trips.");
    trips.push(...data);
    if (data.length < pageSize) return trips;
  }
}
