import { formatExactUnits, parseExactUnits } from "@/features/balances/balances";
import type { TripSummary } from "@/features/trips/queries";

export type TripScheduleStatus = "upcoming" | "active" | "completed";

export function getTripScheduleStatus(
  trip: Pick<TripSummary, "start_date" | "end_date">,
  today: string,
): TripScheduleStatus {
  if (trip.start_date > today) return "upcoming";
  if (trip.end_date && trip.end_date < today) return "completed";
  return "active";
}

export function formatTripAmount(amount: string, currency: string): string {
  const units = parseExactUnits(amount);
  if (units === null) throw new Error("Invalid monetary amount returned for a trip.");
  return `${formatExactUnits(units)} ${currency}`;
}

export function formatTripBalance(balance: string, currency: string): {
  label: string;
  amount: string;
} {
  const units = parseExactUnits(balance);
  if (units === null) throw new Error("Invalid balance returned for a trip.");
  if (units === 0n) return { label: "Settled", amount: `${formatExactUnits(units)} ${currency}` };
  return {
    label: units > 0n ? "You are owed" : "You owe",
    amount: `${formatExactUnits(units < 0n ? -units : units)} ${currency}`,
  };
}
