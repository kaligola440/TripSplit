import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-shell";
import { InvitationResponse } from "@/features/participants/invitation-response";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Trip invitation | TripSplit", referrer: "no-referrer" };

export default async function InvitationPage() {
  const { userId } = await getVerifiedAuthContext();
  return <AuthShell title="Trip invitation" description="Your next shared adventure awaits.">
    <InvitationResponse signedIn={Boolean(userId)} />
  </AuthShell>;
}
