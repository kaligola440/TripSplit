"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, successState, type AuthFormState } from "@/features/auth/form-state";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";
import { validateExpense } from "@/features/expenses/validation";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function databaseMessage(code?: string, message?: string) {
  if (code === "55000" || message?.includes("Settlements exist")) {
    return "This trip already has settlements. Expense changes are locked to preserve its financial history.";
  }
  if (code === "42501") return "You are not authorized to change this expense.";
  if (code === "23503") return "The payer and everyone sharing this expense must be active participants in this trip.";
  if (code === "23514") return "The shares are inconsistent. Check the split amounts and try again.";
  if (code === "22023") return "One or more expense details are invalid.";
  return "We couldn't save the expense. Please review the details and try again.";
}

async function saveExpense(
  tripId: string,
  expenseId: string | null,
  formData: FormData,
): Promise<AuthFormState & { expenseId?: string }> {
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId) || (expenseId !== null && !isUuid(expenseId))) {
    return errorState("This trip or expense could not be found.");
  }
  const [{ data: trip, error: tripError }, { data: activeParticipants, error: participantError }] = await Promise.all([
    supabase.from("trips").select("currency").eq("id", tripId).maybeSingle(),
    supabase.from("trip_participants").select("id, display_name").eq("trip_id", tripId).eq("status", "active"),
  ]);
  if (tripError || participantError || !trip) return errorState("This trip could not be found or you cannot access it.");
  const validation = validateExpense(formData, activeParticipants.map(({ id, display_name }) => ({ id, name: display_name })), trip.currency);
  if (!validation.success) return errorState("Please correct the highlighted fields.", validation.fieldErrors);

  const { data, error } = await supabase.rpc("save_expense_with_shares", {
    p_expense_id: expenseId,
    p_trip_id: tripId,
    p_description: validation.data.description,
    p_amount: validation.data.amount,
    p_currency: validation.data.currency,
    p_expense_date: validation.data.expenseDate,
    p_paid_by_participant_id: validation.data.payerId,
    p_shares: validation.data.shares,
    p_category: validation.data.category,
    p_notes: validation.data.notes,
  });
  if (error || !data) return errorState(databaseMessage(error?.code, error?.message));
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/expenses`);
  revalidatePath(`/trips/${tripId}/expenses/${data}`);
  return { ...successState(expenseId ? "Expense updated." : "Expense created."), expenseId: data };
}

export async function createExpense(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const tripId = formData.get("tripId");
  if (typeof tripId !== "string" || !isTripId(tripId)) return errorState("This trip could not be found.");
  const result = await saveExpense(tripId, null, formData);
  if (result.expenseId) redirect(`/trips/${tripId}/expenses/${result.expenseId}?created=1`);
  return result;
}

export async function updateExpense(
  tripId: string,
  expenseId: string,
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  void _previousState;
  const result = await saveExpense(tripId, expenseId, formData);
  return result;
}

export async function deleteExpense(
  tripId: string,
  expenseId: string,
  _previousState: AuthFormState,
): Promise<AuthFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId) || !isUuid(expenseId)) return errorState("This trip or expense could not be found.");
  const { data, error } = await supabase.rpc("delete_expense", { p_trip_id: tripId, p_expense_id: expenseId });
  if (error) return errorState(databaseMessage(error.code, error.message));
  if (data === "settlements_exist") return errorState("This trip already has settlements. The expense cannot be deleted without risking incorrect financial history.");
  if (data !== "deleted") return errorState("This expense could not be deleted.");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?expenseDeleted=1`);
}

