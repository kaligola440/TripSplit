import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/features/auth/auth-shell";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

type ResetPasswordPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const [{ userId }, params] = await Promise.all([
    getVerifiedAuthContext(),
    searchParams,
  ]);
  const hasValidSession = Boolean(userId);

  return (
    <AuthShell
      title="Choose a new password"
      description="Use a strong password that you haven’t used before."
      footer={
        <Link
          href="/login"
          className="font-semibold text-emerald-800 hover:text-emerald-950"
        >
          Back to sign in
        </Link>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <KeyRound aria-hidden="true" size={20} />
        <p className="text-sm font-medium">
          Your password is stored securely by Supabase Auth.
        </p>
      </div>
      {hasValidSession ? (
        <ResetPasswordForm />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950"
        >
          {params.error === "expired"
            ? "This password reset link is invalid or has expired. Request a new link to continue."
            : "Open a valid password reset link from your email to choose a new password."}{" "}
          <Link
            href="/forgot-password"
            className="font-semibold underline underline-offset-2"
          >
            Request another link
          </Link>
          .
        </div>
      )}
    </AuthShell>
  );
}
