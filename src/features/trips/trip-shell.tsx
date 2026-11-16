import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/features/auth/actions";
import { SignOutButton } from "@/features/auth/sign-out-button";

export function TripShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 py-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark /><span className="text-lg font-semibold tracking-tight">Trip<span className="text-emerald-700">Split</span></span>
          </Link>
          <nav aria-label="Account navigation" className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-xs font-medium text-slate-700 sm:gap-x-6 sm:text-sm">
            <Link href="/trips" className="hover:text-emerald-800">Trips</Link>
            <Link href="/invitations" className="hover:text-emerald-800">Invitations</Link>
            <Link href="/profile" className="hover:text-emerald-800">Profile</Link>
            <form action={signOut}>
              <SignOutButton className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-65" />
            </form>
          </nav>
        </header>
        {children}
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 py-6 text-xs text-slate-600">
          <span>TripSplit</span>
          <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-emerald-800">Privacy</Link>
            <Link href="/terms" className="hover:text-emerald-800">Terms</Link>
            <Link href="/contact" className="hover:text-emerald-800">Contact</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}

export function formatTripDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
