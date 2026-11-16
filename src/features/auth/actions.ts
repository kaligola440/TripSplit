"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authErrorMessage,
  buildAuthCallbackUrl,
  validateEmailAddress,
  validateLogin,
  validatePasswordReset,
  validateProfile,
  validateRegistration,
} from "@/features/auth/validation";
import {
  errorState,
  successState,
  type AuthFormState,
} from "@/features/auth/form-state";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";

export async function register(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateRegistration(formData);
  if (!validation.success) {
    return errorState(
      "Please correct the highlighted fields.",
      validation.fieldErrors,
    );
  }

  const origin = (await headers()).get("origin");
  const emailRedirectTo = origin
    ? buildAuthCallbackUrl(origin, "/profile")
    : null;
  if (!emailRedirectTo) {
    return errorState(
      "Registration is temporarily unavailable. Please try again.",
    );
  }

  const { supabase } = await getVerifiedAuthContext();
  const { data, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      data: { display_name: validation.data.displayName },
      emailRedirectTo,
    },
  });

  if (error) {
    return errorState(authErrorMessage(error, "registration"));
  }

  if (data.session) {
    redirect("/profile");
  }

  if (!data.user) {
    return errorState("We couldn't complete registration. Please try again.");
  }

  return successState(
    "If this email address can be used, a confirmation link will arrive shortly. Check your inbox to continue.",
  );
}

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateLogin(formData);
  if (!validation.success) {
    return errorState(
      "Please correct the highlighted fields.",
      validation.fieldErrors,
    );
  }

  const { supabase } = await getVerifiedAuthContext();
  const { data, error } = await supabase.auth.signInWithPassword(validation.data);

  if (error) {
    return errorState(authErrorMessage(error, "login"));
  }

  if (!data.session || !data.user) {
    return errorState("We couldn't complete sign-in. Please try again.");
  }

  redirect("/profile");
}

export async function requestPasswordReset(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateEmailAddress(formData);
  if (!validation.success) {
    return errorState("Enter a valid email address.", {
      email: validation.fieldErrors.email ?? "Enter a valid email address.",
    });
  }

  const origin = (await headers()).get("origin");
  const redirectTo = origin
    ? buildAuthCallbackUrl(origin, "/reset-password")
    : null;
  if (!redirectTo) {
    return errorState(
      "Password recovery is temporarily unavailable. Please try again.",
    );
  }

  const { supabase } = await getVerifiedAuthContext();
  const { error } = await supabase.auth.resetPasswordForEmail(
    validation.data.email,
    { redirectTo },
  );

  if (error) {
    return errorState(authErrorMessage(error, "password"));
  }

  return successState(
    "If an account exists for that email, a password reset link will arrive shortly.",
  );
}

export async function resetPassword(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validatePasswordReset(formData);
  if (!validation.success) {
    return errorState(
      "Please correct the highlighted fields.",
      validation.fieldErrors,
    );
  }

  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) {
    return errorState(
      "This reset link is invalid or has expired. Request a new link to continue.",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: validation.data.password,
  });
  if (error) {
    return errorState(authErrorMessage(error, "password"));
  }

  redirect("/profile?status=password-updated");
}

export async function updateProfile(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateProfile(formData);
  if (!validation.success) {
    return errorState(
      "Please correct the highlighted fields.",
      validation.fieldErrors,
    );
  }

  const { supabase, userId } = await getVerifiedAuthContext();
  if (!userId) {
    return errorState("Your session has expired. Sign in again to update your profile.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: validation.data.displayName,
      avatar_url: validation.data.avatarUrl,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    return errorState("We couldn't save your profile. Please try again.");
  }

  if (!data) {
    return errorState(
      "Your profile could not be found. No profile record was created.",
    );
  }

  revalidatePath("/profile");
  return successState("Your profile has been updated.");
}

export async function signOut(): Promise<void> {
  const { supabase } = await getVerifiedAuthContext();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  redirect(error ? "/login?error=logout" : "/login?status=signed-out");
}
