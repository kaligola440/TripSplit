import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { AuthShell } from "@/features/auth/auth-shell";
import { RegisterForm } from "@/features/auth/register-form";
import { getVerifiedAuthContext } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage() {
  const { userId } = await getVerifiedAuthContext();
  if (userId) {
    redirect("/profile");
  }

  return (
    <AuthShell
      title="Create your account"
      description="Start planning together and make shared costs simpler."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Sign in
          </Link>
        </>
      }
    >
      <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
        <UserRoundPlus aria-hidden="true" size={20} />
        <p className="text-sm font-medium">
          We&apos;ll send a confirmation link to your email.
        </p>
      </div>
      <RegisterForm />
    </AuthShell>
  );
}
