import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AuthShell } from "@/features/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email address linked to your account and we’ll send a reset link."
      footer={
        <>
          Remembered your password?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <KeyRound aria-hidden="true" size={20} />
        <p className="text-sm font-medium">We&apos;ll help you get back in securely.</p>
      </div>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
