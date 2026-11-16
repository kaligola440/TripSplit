import Link from "next/link";
import { LogIn } from "lucide-react";
import { AuthShell } from "@/features/auth/auth-shell";
import { LoginForm } from "@/features/auth/login-form";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

function getNotice(
  error?: string,
  status?: string,
  verificationFailed = false,
): string | undefined {
  if (error === "session") {
    return "Your session could not be verified. Please sign in again.";
  }
  if (error === "required") {
    return "Sign in to access your profile.";
  }
  if (error === "confirmation") {
    return "That confirmation link is invalid or has expired. Request a new email or sign in.";
  }
  if (error === "logout") {
    return "We couldn't confirm sign-out. Please try again.";
  }
  if (status === "signed-out") {
    return "You have been signed out.";
  }
  if (verificationFailed) {
    return "Your session could not be verified. Please sign in again.";
  }
  return undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [{ userId, verificationFailed }, params] = await Promise.all([
    getVerifiedAuthContext(),
    searchParams,
  ]);
  if (userId) {
    redirect("/profile");
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to pick up where your next trip begins."
      footer={
        <>
          New to TripSplit?{" "}
          <Link
            href="/register"
            className="font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Create an account
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <LogIn aria-hidden="true" size={20} />
        <p className="text-sm font-medium">Your shared plans, all in one place.</p>
      </div>
      <LoginForm
        notice={getNotice(params.error, params.status, verificationFailed)}
      />
    </AuthShell>
  );
}
