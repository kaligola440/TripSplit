"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorState, successState, type AuthFormState } from "@/features/auth/form-state";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { isTripId, validateTrip } from "@/features/trips/validation";

export async function createTrip(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again to create a trip.");
  const validation = validateTrip(formData);
  if (!validation.success) return errorState("Please correct the highlighted fields.", validation.fieldErrors);

  const { data, error } = await supabase.from("trips")
    .insert({ ...validation.data, created_by: userId })
    .select("id")
    .single();
  if (error || !data) return errorState("We couldn't create your trip. Please try again.");
  revalidatePath("/trips");
  redirect(`/trips/${data.id}?created=1`);
}

export async function updateTrip(
  tripId: string,
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again to edit this trip.");
  if (!isTripId(tripId)) return errorState("This trip could not be found or you cannot edit it.");
  const validation = validateTrip(formData);
  if (!validation.success) return errorState("Please correct the highlighted fields.", validation.fieldErrors);

  const { data, error } = await supabase.from("trips")
    .update(validation.data)
    .eq("id", tripId)
    .eq("created_by", userId)
    .select("id")
    .maybeSingle();
  if (error) return errorState("We couldn't save your trip. Please try again.");
  if (!data) return errorState("This trip could not be found or you cannot edit it.");
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  return successState("Your trip has been updated.");
}
