import { formatUnits, parseMoney, parsePercentage, PERCENT_SCALE } from "@/features/expenses/money";
import { formatPersonName } from "@/lib/person-name";

export type SplitMethod = "equal" | "custom" | "percentage";
export type SplitParticipant = { id: string; name: string };
export type ExpenseShareInput = {
  participant_id: string;
  share_amount: string;
  share_type: SplitMethod;
  share_percentage: string | null;
};
export type SplitResult =
  | { success: true; shares: ExpenseShareInput[] }
  | { success: false; message: string; field?: string };

export function calculateShares(
  amount: string,
  participants: SplitParticipant[],
  method: SplitMethod,
  values: Record<string, string>,
): SplitResult {
  const total = parseMoney(amount);
  if (total === null || total <= 0n) return { success: false, message: "Enter a positive amount with no more than six decimal places.", field: "amount" };
  if (participants.length === 0) return { success: false, message: "Select at least one participant to share this expense.", field: "participants" };
  const sorted = [...participants].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(sorted.map(({ id }) => id)).size !== sorted.length) return { success: false, message: "The share list contains duplicate participants.", field: "participants" };
  const amounts: bigint[] = [];
  const percentages: (bigint | null)[] = [];

  if (method === "equal") {
    const base = total / BigInt(sorted.length);
    let remaining = 0n;
    sorted.forEach((participant, index) => {
      const share = index === sorted.length - 1 ? total - remaining : base;
      amounts.push(share);
      remaining += share;
      percentages.push(null);
    });
  } else if (method === "custom") {
    let sum = 0n;
    for (const participant of sorted) {
      const share = parseMoney(values[participant.id] ?? "");
      if (share === null || share < 0n) return { success: false, message: `Enter a valid non-negative share for ${formatPersonName(participant.name)}.`, field: `share-${participant.id}` };
      amounts.push(share);
      percentages.push(null);
      sum += share;
    }
    if (sum !== total) return { success: false, message: "Custom shares must add up exactly to the expense total.", field: "shares" };
  } else {
    const parsed: bigint[] = [];
    for (const participant of sorted) {
      const percentage = parsePercentage(values[participant.id] ?? "");
      if (percentage === null) return { success: false, message: `Enter a percentage from 0 to 100 with up to six decimal places for ${formatPersonName(participant.name)}.`, field: `share-${participant.id}` };
      parsed.push(percentage);
    }
    if (parsed.reduce((sum, value) => sum + value, 0n) !== 100n * PERCENT_SCALE) {
      return { success: false, message: "Percentages must add up exactly to 100%.", field: "shares" };
    }
    let allocated = 0n;
    sorted.forEach((participant, index) => {
      const share = index === sorted.length - 1
        ? total - allocated
        : total * parsed[index] / (100n * PERCENT_SCALE);
      amounts.push(share);
      percentages.push(parsed[index]);
      allocated += share;
    });
  }

  return {
    success: true,
    shares: sorted.map((participant, index) => ({
      participant_id: participant.id,
      share_amount: formatUnits(amounts[index]),
      share_type: method,
      share_percentage: percentages[index] === null ? null : formatUnits(percentages[index]!),
    })),
  };
}
