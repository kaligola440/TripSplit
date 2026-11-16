import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getVerifiedAuthContext() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId =
    !error && data && typeof data.claims?.sub === "string"
      ? data.claims.sub
      : null;

  return {
    supabase,
    userId,
    verificationFailed:
      error !== null && error.name !== "AuthSessionMissingError",
  };
}

export async function requireAuthenticatedUser() {
  const context = await getVerifiedAuthContext();

  if (!context.userId) {
    redirect(
      context.verificationFailed
        ? "/login?error=session"
        : "/login?error=required",
    );
  }

  return { supabase: context.supabase, userId: context.userId };
}
