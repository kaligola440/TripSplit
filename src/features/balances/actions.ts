"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, type AuthFormState } from "@/features/auth/form-state";
import { validateSettlement } from "@/features/balances/validation";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { isTripId } from "@/features/trips/validation";

function databaseMessage(code?: string, message?: string) {
  if (code === "42501") return "You are not authorized to record a settlement for this trip.";
  if (code === "23503") return "The payer and recipient must be participants in this trip.";
  if (code === "23514") return "The balances have changed or the amount exceeds the payer's debt or recipient's credit. Refresh and try again.";
  if (code === "22023") return "One or more settlement details are invalid.";
  if (code === "23505" || message?.includes("Duplicate settlement")) return "An identical settlement has already been recorded.";
  return "We couldn't record the settlement. Please review the details and try again.";
}

export async function recordTripSettlement(
  tripId: string,
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId)) {
    return errorState("This trip could not be found.");
  }

  const validation = validateSettlement(formData);
  if (!validation.success) {
    return errorState("Please correct the highlighted fields.", validation.fieldErrors);
  }

  const { data, error } = await supabase.rpc("record_trip_settlement", {
    p_trip_id: tripId,
    p_from_participant_id: validation.data.fromParticipantId,
    p_to_participant_id: validation.data.toParticipantId,
    p_amount: validation.data.amount,
    p_payment_date: validation.data.paymentDate,
    p_notes: validation.data.notes,
  });
  if (error || !data) return errorState(databaseMessage(error?.code, error?.message));
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?settlementRecorded=1`);
}
