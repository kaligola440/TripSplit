export function formatPersonName(
  displayName: string | null | undefined,
  fallback = "TripSplit member",
): string {
  return displayName?.trim().replace(/\s+/g, " ") || fallback;
}
