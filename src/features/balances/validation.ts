import { parseMoney } from "@/features/expenses/money";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type SettlementInput = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: string;
  paymentDate: string;
  notes: string | null;
};

export type SettlementValidation =
  | { success: true; data: SettlementInput }
  | { success: false; fieldErrors: Record<string, string> };

function isRealDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= monthLengths[month - 1];
}

export function validateSettlement(formData: FormData): SettlementValidation {
  const fromValue = formData.get("fromParticipantId");
  const toValue = formData.get("toParticipantId");
  const amountValue = formData.get("amount");
  const dateValue = formData.get("paymentDate");
  const notesValue = formData.get("notes");
  const fieldErrors: Record<string, string> = {};

  const fromParticipantId = typeof fromValue === "string" && UUID_PATTERN.test(fromValue) ? fromValue : "";
  const toParticipantId = typeof toValue === "string" && UUID_PATTERN.test(toValue) ? toValue : "";
  if (!fromParticipantId) {
    fieldErrors.fromParticipantId = "Choose a participant who owes money.";
  }
  if (!toParticipantId) {
    fieldErrors.toParticipantId = "Choose a participant who is owed money.";
  }
  if (fromParticipantId && fromParticipantId === toParticipantId) {
    fieldErrors.toParticipantId = "Payer and recipient must be different.";
  }
  const amount = typeof amountValue === "string" ? amountValue.trim() : "";
  const amountUnits = parseMoney(amount);
  if (amountUnits === null || amountUnits <= 0n) fieldErrors.amount = "Enter an amount greater than zero with up to six decimal places.";
  const paymentDate = typeof dateValue === "string" ? dateValue : "";
  if (!isRealDate(paymentDate)) fieldErrors.paymentDate = "Enter a valid payment date.";
  const notes = typeof notesValue === "string" ? notesValue.trim() : "";
  if (notes.length > 5000) fieldErrors.notes = "Notes must be 5,000 characters or fewer.";

  if (Object.keys(fieldErrors).length) return { success: false, fieldErrors };
  return {
    success: true,
    data: {
      fromParticipantId,
      toParticipantId,
      amount,
      paymentDate,
      notes: notes || null,
    },
  };
}
