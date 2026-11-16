import type { Json } from "@/types/database.types";
import {
  calculateNetBalance,
  parseExactUnits,
  type BalanceParticipant,
} from "@/features/balances/balances";

export type SettlementRecord = {
  id: string;
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: string;
  currency: string;
  paymentDate: string;
  notes: string | null;
  createdAt: string;
};

export type TripFinancials = {
  participants: BalanceParticipant[];
  settlements: SettlementRecord[];
};

function object(value: Json | undefined): { [key: string]: Json | undefined } | null {
  return value && !Array.isArray(value) && typeof value === "object" ? value : null;
}

function string(value: Json | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export function parseTripFinancials(value: Json | null): TripFinancials | null {
  const root = object(value);
  if (!root || !Array.isArray(root.participants) || !Array.isArray(root.settlements)) return null;
  const participants: BalanceParticipant[] = [];

  for (const item of root.participants) {
    const row = object(item);
    if (!row) return null;
    const id = string(row.id);
    const name = string(row.display_name);
    const status = string(row.status);
    const email = row.email === null ? null : string(row.email);
    const paidAmount = string(row.paid_amount);
    const owedAmount = string(row.owed_amount);
    const settlementsPaid = string(row.settlements_paid);
    const settlementsReceived = string(row.settlements_received);
    const amounts = [paidAmount, owedAmount, settlementsPaid, settlementsReceived];
    const amountUnits = amounts.map((amount) => amount ? parseExactUnits(amount) : null);
    if (!id || !name || (status !== "active" && status !== "inactive") ||
      (row.email !== null && email === null) || !paidAmount || !owedAmount ||
      !settlementsPaid || !settlementsReceived ||
      amountUnits.some((units) => units === null || units < 0n)) return null;
    participants.push({
      id,
      name,
      email,
      status,
      paidAmount,
      owedAmount,
      settlementsPaid,
      settlementsReceived,
      netBalance: calculateNetBalance({ paidAmount, owedAmount, settlementsPaid, settlementsReceived }),
    });
  }

  const settlements: SettlementRecord[] = [];
  for (const item of root.settlements) {
    const row = object(item);
    if (!row) return null;
    const id = string(row.id);
    const fromParticipantId = string(row.from_participant_id);
    const fromName = string(row.from_name);
    const toParticipantId = string(row.to_participant_id);
    const toName = string(row.to_name);
    const amount = string(row.amount);
    const currency = string(row.currency);
    const paymentDate = string(row.payment_date);
    const createdAt = string(row.created_at);
    const notes = row.notes === null ? null : string(row.notes);
    const amountUnits = amount ? parseExactUnits(amount) : null;
    if (!id || !fromParticipantId || !fromName || !toParticipantId || !toName ||
      !amount || amountUnits === null || amountUnits <= 0n || !currency || !paymentDate || !createdAt ||
      (row.notes !== null && notes === null)) return null;
    settlements.push({
      id,
      fromParticipantId,
      fromName,
      toParticipantId,
      toName,
      amount,
      currency,
      paymentDate,
      notes,
      createdAt,
    });
  }
  return { participants, settlements };
}
