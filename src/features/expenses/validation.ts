import { calculateShares, type SplitMethod, type SplitParticipant } from "@/features/expenses/splits";

const CATEGORIES = ["accommodation", "activities", "food", "groceries", "transport", "other"] as const;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateExpense(formData: FormData, participants: SplitParticipant[], currency: string) {
  const value = (key: string) => {
    const result = formData.get(key);
    return typeof result === "string" ? result.trim() : "";
  };
  const description = value("description");
  const amount = value("amount");
  const expenseDate = value("expenseDate");
  const category = value("category");
  const payerId = value("payerId");
  const notes = value("notes");
  const methodValue = value("splitMethod");
  const fieldErrors: Record<string, string> = {};
  const participantIds = formData.getAll("participantIds").filter((id): id is string => typeof id === "string");
  const selected = participantIds.map((id) => participants.find((participant) => participant.id === id)).filter((item): item is SplitParticipant => Boolean(item));
  if (!description || Array.from(description).length > 240) fieldErrors.description = "Enter a description between 1 and 240 characters.";
  if (!isValidDate(expenseDate)) fieldErrors.expenseDate = "Enter a valid expense date.";
  if (!(CATEGORIES as readonly string[]).includes(category)) fieldErrors.category = "Choose a valid category.";
  if (notes.length > 5000) fieldErrors.notes = "Notes must be 5,000 characters or fewer.";
  if (!participants.some((participant) => participant.id === payerId)) fieldErrors.payerId = "Choose an active participant who paid.";
  if (participantIds.length !== selected.length || new Set(participantIds).size !== participantIds.length) fieldErrors.participants = "Choose valid, unique active participants.";
  if (!["equal", "custom", "percentage"].includes(methodValue)) fieldErrors.splitMethod = "Choose a split method.";
  if (Object.keys(fieldErrors).length) return { success: false as const, fieldErrors };

  const method = methodValue as SplitMethod;
  const values = Object.fromEntries(selected.map((participant) => [
    participant.id,
    value(method === "custom" ? `amount-${participant.id}` : `percentage-${participant.id}`),
  ]));
  const split = calculateShares(amount, selected, method, values);
  if (!split.success) {
    return { success: false as const, fieldErrors: { [split.field ?? "shares"]: split.message } };
  }
  return {
    success: true as const,
    data: {
      description, amount, currency, expenseDate, category, payerId, notes: notes || null,
      splitMethod: method, participantIds, shares: split.shares,
    },
  };
}

export function validateExpenseFilters(params: Record<string, string | string[] | undefined>) {
  const scalar = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const dateFrom = scalar("from");
  const dateTo = scalar("to");
  const category = scalar("category");
  const payer = scalar("payer");
  const search = scalar("q").slice(0, 120);
  const sortValue = scalar("sort");
  const validDate = (value: string) => !value || isValidDate(value);
  return {
    dateFrom: validDate(dateFrom) ? dateFrom || null : null,
    dateTo: validDate(dateTo) ? dateTo || null : null,
    category: (CATEGORIES as readonly string[]).includes(category) ? category : null,
    payer: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payer) ? payer : null,
    search: search || null,
    sort: ["date_asc", "date_desc", "amount_asc", "amount_desc"].includes(sortValue) ? sortValue : "date_desc",
  };
}

export const expenseCategories = [...CATEGORIES];
