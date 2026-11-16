import Link from "next/link";
import {
  CalendarDays,
  CircleUserRound,
  LogOut,
  Mail,
  UserRound,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ProfileForm } from "@/features/auth/profile-form";
import { signOut } from "@/features/auth/actions";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

type ProfilePageProps = {
  searchParams: Promise<{
    confirmed?: string;
    status?: string;
  }>;
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default async function ProfilePage({
  searchParams,
}: ProfilePageProps) {
  const [{ supabase, userId }, params] = await Promise.all([
    requireAuthenticatedUser(),
    searchParams,
  ]);
  const [{ data: claimsUser, error: userError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, created_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  if (userError || !claimsUser.user || claimsUser.user.id !== userId) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] px-5 py-16 text-slate-950">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-white p-7 text-sm leading-6 text-rose-900"
        >
          Your session could not be verified.{" "}
          <Link href="/login" className="font-semibold underline">
            Sign in again
          </Link>
          .
        </div>
      </main>
    );
  }

  if (profileError) {
    throw new Error("Unable to load the signed-in user's profile.");
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[#f7f8f6] px-5 py-16 text-slate-950">
        <div
          role="alert"
          className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-7 text-sm leading-6 text-amber-950"
        >
          Your profile record is missing. TripSplit did not create a duplicate
          record. Check that the Supabase profile trigger is enabled, then ask
          an administrator to investigate.
        </div>
      </main>
    );
  }

  const avatarUrl = profile.avatar_url?.startsWith("https://")
    ? profile.avatar_url
    : null;
  const displayName =
    profile.display_name?.trim() || claimsUser.user.email || "TripSplit member";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8f6] px-5 text-slate-950 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-40 size-[30rem] rounded-full bg-emerald-100/60 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-slate-200/80 py-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">
              Trip<span className="text-emerald-700">Split</span>
            </span>
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <LogOut aria-hidden="true" size={16} />
              Sign out
            </button>
          </form>
        </header>

        <section className="mx-auto grid max-w-5xl gap-8 py-10 md:grid-cols-[0.8fr_1.2fr] md:py-16">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.2)] sm:p-9">
            <div className="mb-6 flex size-20 items-center justify-center overflow-hidden rounded-full bg-emerald-50 text-emerald-800 ring-4 ring-emerald-50">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                />
              ) : (
                <UserRound aria-hidden="true" size={34} strokeWidth={1.6} />
              )}
            </div>
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              {displayName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">TripSplit account</p>

            <div className="mt-7 space-y-4 border-t border-slate-100 pt-6">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <Mail
                  aria-hidden="true"
                  size={17}
                  className="mt-0.5 shrink-0 text-emerald-800"
                />
                <span className="break-all">{claimsUser.user.email}</span>
              </div>
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <CalendarDays
                  aria-hidden="true"
                  size={17}
                  className="mt-0.5 shrink-0 text-emerald-800"
                />
                <span>Member since {displayDate(claimsUser.user.created_at)}</span>
              </div>
            </div>

            {params.confirmed === "1" ? (
              <p
                role="status"
                className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              >
                Your email has been confirmed. Welcome to TripSplit.
              </p>
            ) : null}
            {params.status === "password-updated" ? (
              <p
                role="status"
                className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900"
              >
                Your password has been updated.
              </p>
            ) : null}
          </div>

          <section
            aria-labelledby="profile-details-title"
            className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.2)] sm:p-9"
          >
            <div className="mb-7 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <CircleUserRound aria-hidden="true" size={22} />
              </div>
              <div>
                <h2
                  id="profile-details-title"
                  className="font-semibold tracking-tight"
                >
                  Profile details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep your account information up to date.
                </p>
              </div>
            </div>
            <ProfileForm
              displayName={profile.display_name ?? ""}
              avatarUrl={profile.avatar_url ?? ""}
            />
          </section>
        </section>
      </div>
    </main>
  );
}
