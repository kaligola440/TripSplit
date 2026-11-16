"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { errorState, successState, type AuthFormState } from "@/features/auth/form-state";
import { isTripId } from "@/features/trips/validation";
import { validateParticipant } from "@/features/participants/validation";
import { hashInvitationToken, isInvitationToken, newInvitationToken } from "@/features/participants/tokens";
import { invitationMailSettings, sendInvitation } from "@/features/participants/email";

export type ParticipantFormState = AuthFormState & { developmentLink?: string; tripId?: string };

function mutationError(code?: string) {
  if (code === "23505") return "A participant or pending invitation already exists for this email.";
  if (code === "42501") return "You are not authorized to manage these participants.";
  if (code === "23503") return "This participant has financial history and cannot be removed.";
  return "We couldn't complete this request. Please try again.";
}

function refresh(tripId: string) {
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

export async function addParticipant(
  tripId: string, _previousState: ParticipantFormState, formData: FormData,
): Promise<ParticipantFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId)) return errorState("This trip could not be found.");
  const validation = validateParticipant(formData);
  if (!validation.success) return errorState("Please correct the highlighted fields.", validation.fieldErrors);
  const mode = formData.get("mode");
  if (mode !== "external" && mode !== "invite") return errorState("Choose how to add this participant.");

  if (mode === "external") {
    const { error } = await supabase.rpc("add_external_participant", {
      p_trip_id: tripId, p_name: validation.data.name, p_email: validation.data.email,
    });
    if (error) return errorState(mutationError(error.code));
    refresh(tripId);
    return successState("External participant added. They do not have access to this trip.");
  }

  const settings = invitationMailSettings();
  if (settings.kind === "unavailable") return errorState(settings.message);
  const { data: trip, error: tripError } = await supabase.from("trips").select("name").eq("id", tripId).maybeSingle();
  if (tripError || !trip) return errorState("This trip could not be found or you cannot access it.");
  const token = newInvitationToken();
  const { error } = await supabase.rpc("create_trip_invitation", {
    p_trip_id: tripId, p_name: validation.data.name, p_email: validation.data.email, p_token_hash: hashInvitationToken(token),
  });
  if (error) return errorState(mutationError(error.code));
  refresh(tripId);
  const delivery = await sendInvitation(settings, validation.data.email, trip.name, token);
  if (delivery.developmentLink) return { status: "success", message: "Development only: no email was sent. Share this link privately with the invitee.", developmentLink: delivery.developmentLink };
  if (!delivery.sent) return errorState("The invitation was created, but the email could not be sent. Please resend it.");
  return successState("The email provider accepted the invitation for delivery.");
}

export async function resendInvitation(
  tripId: string, invitationId: string, _previousState: ParticipantFormState,
): Promise<ParticipantFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId) || !isTripId(invitationId)) return errorState("This invitation could not be found.");
  const settings = invitationMailSettings();
  if (settings.kind === "unavailable") return errorState(settings.message);
  const { data: trip, error: tripError } = await supabase.from("trips").select("name").eq("id", tripId).maybeSingle();
  if (tripError || !trip) return errorState("This trip could not be found or you cannot access it.");
  const token = newInvitationToken();
  const { data: email, error } = await supabase.rpc("resend_trip_invitation", {
    p_trip_id: tripId, p_invitation_id: invitationId, p_token_hash: hashInvitationToken(token),
  });
  if (error || !email) return errorState(mutationError(error?.code));
  refresh(tripId);
  const delivery = await sendInvitation(settings, email, trip.name, token);
  if (delivery.developmentLink) return { status: "success", message: "Development only: no email was sent. The old link no longer works; share this new link privately.", developmentLink: delivery.developmentLink };
  if (!delivery.sent) return errorState("The invitation was renewed, but the email could not be sent. The old link no longer works; please resend it.");
  return successState("The email provider accepted the invitation for delivery. The previous link no longer works.");
}

export async function cancelInvitation(
  tripId: string, invitationId: string, _previousState: ParticipantFormState,
): Promise<ParticipantFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId) || !isTripId(invitationId)) return errorState("This invitation could not be found.");
  const { error } = await supabase.rpc("cancel_trip_invitation", { p_trip_id: tripId, p_invitation_id: invitationId });
  if (error) return errorState(mutationError(error.code));
  refresh(tripId);
  return successState("Invitation cancelled.");
}

export async function removeParticipant(
  tripId: string, participantId: string, _previousState: ParticipantFormState,
): Promise<ParticipantFormState> {
  void _previousState;
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Your session has expired. Sign in again.");
  if (!isTripId(tripId) || !isTripId(participantId)) return errorState("This participant could not be found.");
  const { data, error } = await supabase.rpc("remove_trip_participant", { p_trip_id: tripId, p_participant_id: participantId });
  if (error) return errorState(mutationError(error.code));
  if (data === "financial_history") return errorState("This participant has financial history and cannot be removed. Keep their record to preserve the trip's expenses and settlements.");
  if (data !== "removed") return errorState("This participant cannot be removed.");
  refresh(tripId);
  return successState("Participant removed.");
}

export async function respondToInvitation(
  _previousState: ParticipantFormState, formData: FormData,
): Promise<ParticipantFormState> {
  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) return errorState("Sign in with the invited email address, then reopen the invitation link.");
  const token = formData.get("token");
  const decision = formData.get("decision");
  if (typeof token !== "string" || !isInvitationToken(token) || (decision !== "accept" && decision !== "reject")) {
    return errorState("This invitation link is invalid.");
  }
  const { data, error } = await supabase.rpc("respond_to_trip_invitation", {
    p_token: token, p_accept: decision === "accept",
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return errorState("We couldn't process this invitation. Please try again.");
  const status = data.status;
  if (status === "accepted" && typeof data.trip_id === "string" && isTripId(data.trip_id)) {
    refresh(data.trip_id);
    return { status: "success", message: "Invitation accepted. You can now access the trip.", tripId: data.trip_id };
  }
  if (status === "rejected") return successState("Invitation declined.");
  if (status === "email_mismatch") return errorState("This invitation belongs to a different email address. Sign in with the invited account.");
  if (status === "unconfirmed") return errorState("Confirm your email address before responding to this invitation.");
  if (status === "expired") return errorState("This invitation has expired. Ask the trip manager for a new link.");
  if (status === "used") return errorState("This invitation has already been used or cancelled.");
  if (status === "conflict") return errorState("This participant cannot be linked automatically. Ask the trip manager for help.");
  return errorState("This invitation link is invalid or no longer available.");
}
