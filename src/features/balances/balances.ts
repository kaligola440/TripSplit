import { MONEY_SCALE } from "@/features/expenses/money";

const EXACT_AMOUNT_PATTERN = /^(-?)(0|[1-9]\d{0,29})(?:\.(\d{1,6}))?$/;

export type BalanceComponents = {
  paidAmount: string;
  owedAmount: string;
  settlementsPaid: string;
  settlementsReceived: string;
};

export type BalanceParticipant = {
  id: string;
  name: string;
  email: string | null;
  status: "active" | "inactive";
  paidAmount: string;
  owedAmount: string;
  settlementsPaid: string;
  settlementsReceived: string;
  netBalance: string;
};

export type SettlementSuggestion = {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: string;
};

export function parseExactUnits(value: string): bigint | null {
  const match = EXACT_AMOUNT_PATTERN.exec(value.trim());
  if (!match) return null;
  const fraction = (match[3] ?? "").padEnd(6, "0");
  const units = BigInt(match[2]) * MONEY_SCALE + BigInt(fraction || "0");
  return match[1] && units !== 0n ? -units : units;
}

export function formatExactUnits(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / MONEY_SCALE;
  const fraction = (absolute % MONEY_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function calculateNetBalance(components: BalanceComponents): string {
  const paid = parseExactUnits(components.paidAmount);
  const owed = parseExactUnits(components.owedAmount);
  const settlementsPaid = parseExactUnits(components.settlementsPaid);
  const settlementsReceived = parseExactUnits(components.settlementsReceived);
  if (paid === null || owed === null || settlementsPaid === null || settlementsReceived === null ||
    paid < 0n || owed < 0n || settlementsPaid < 0n || settlementsReceived < 0n) {
    throw new Error("Invalid financial data.");
  }
  return formatExactUnits(paid - owed + settlementsPaid - settlementsReceived);
}

export function suggestSettlements(
  participants: Pick<BalanceParticipant, "id" | "name" | "netBalance">[],
): SettlementSuggestion[] {
  const seen = new Set<string>();
  const debtors: { id: string; name: string; remaining: bigint }[] = [];
  const creditors: { id: string; name: string; remaining: bigint }[] = [];
  let totalDebt = 0n;
  let totalCredit = 0n;

  for (const participant of participants) {
    if (seen.has(participant.id)) throw new Error("Duplicate participant in balances.");
    seen.add(participant.id);
    const balance = parseExactUnits(participant.netBalance);
    if (balance === null) throw new Error("Invalid participant balance.");
    if (balance < 0n) {
      debtors.push({ id: participant.id, name: participant.name, remaining: -balance });
      totalDebt += -balance;
    } else if (balance > 0n) {
      creditors.push({ id: participant.id, name: participant.name, remaining: balance });
      totalCredit += balance;
    }
  }

  if (totalDebt !== totalCredit) throw new Error("Trip balances do not reconcile.");
  const largestFirst = (left: { id: string; remaining: bigint }, right: { id: string; remaining: bigint }) =>
    left.remaining === right.remaining
      ? left.id < right.id ? -1 : left.id > right.id ? 1 : 0
      : left.remaining > right.remaining ? -1 : 1;
  debtors.sort(largestFirst);
  creditors.sort(largestFirst);

  const suggestions: SettlementSuggestion[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
    suggestions.push({
      fromParticipantId: debtor.id,
      fromName: debtor.name,
      toParticipantId: creditor.id,
      toName: creditor.name,
      amount: formatExactUnits(amount),
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0n) debtorIndex++;
    if (creditor.remaining === 0n) creditorIndex++;
  }
  return suggestions;
}
