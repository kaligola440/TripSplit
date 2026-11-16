import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
export type TripSummary = Database["public"]["Functions"]["get_trip_dashboard"]["Returns"][number];

export async function listTrips(supabase: SupabaseClient): Promise<TripSummary[]> {
  const pageSize = 100;
  const trips: TripSummary[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.rpc("get_trip_dashboard", {})
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Unable to load trips.");
    trips.push(...data);
    if (data.length < pageSize) return trips;
  }
}
