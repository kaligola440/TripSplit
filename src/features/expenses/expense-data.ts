import type { Json } from "@/types/database.types";
import type { SplitMethod } from "@/features/expenses/splits";

export type ExpenseDetail = {
  id: string;
  trip_id: string;
  description: string;
  amount: string;
  currency: string;
  category: string;
  expense_date: string;
  paid_by_participant_id: string;
  payer_name: string;
  notes: string | null;
  created_by: string;
  shares: {
    participant_id: string;
    display_name: string;
    email: string | null;
    share_amount: string;
    share_type: SplitMethod;
    share_percentage: string | null;
  }[];
};

export function parseExpenseDetail(value: Json | null): ExpenseDetail | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const field = (key: string) => value[key];
  const stringFields = ["id", "trip_id", "description", "amount", "currency", "category", "expense_date", "paid_by_participant_id", "payer_name", "created_by"];
  if (stringFields.some((key) => typeof field(key) !== "string")) return null;
  if (field("notes") !== null && typeof field("notes") !== "string") return null;
  const rawShares = field("shares");
  if (!Array.isArray(rawShares)) return null;
  const shares: ExpenseDetail["shares"] = [];
  for (const raw of rawShares) {
    if (!raw || Array.isArray(raw) || typeof raw !== "object") return null;
    const shareType = raw.share_type;
    if (shareType !== "equal" && shareType !== "custom" && shareType !== "percentage") return null;
    if (typeof raw.participant_id !== "string" || typeof raw.display_name !== "string" ||
      typeof raw.share_amount !== "string" ||
      (raw.email !== null && typeof raw.email !== "string") ||
      (raw.share_percentage !== null && typeof raw.share_percentage !== "string")) return null;
    shares.push({
      participant_id: raw.participant_id,
      display_name: raw.display_name,
      email: raw.email,
      share_amount: raw.share_amount,
      share_type: shareType,
      share_percentage: raw.share_percentage,
    });
  }
  return {
    id: field("id") as string,
    trip_id: field("trip_id") as string,
    description: field("description") as string,
    amount: field("amount") as string,
    currency: field("currency") as string,
    category: field("category") as string,
    expense_date: field("expense_date") as string,
    paid_by_participant_id: field("paid_by_participant_id") as string,
    payer_name: field("payer_name") as string,
    notes: field("notes") as string | null,
    created_by: field("created_by") as string,
    shares,
  };
}
