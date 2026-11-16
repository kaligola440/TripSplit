import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { signOut } from "@/features/auth/actions";

export function TripShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 py-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark /><span className="text-lg font-semibold tracking-tight">Trip<span className="text-emerald-700">Split</span></span>
          </Link>
          <nav aria-label="Account navigation" className="flex items-center gap-4 text-sm font-medium text-slate-600 sm:gap-6">
            <Link href="/trips" className="hover:text-emerald-800">Trips</Link>
            <Link href="/profile" className="hover:text-emerald-800">Profile</Link>
            <form action={signOut}><button className="rounded-xl border border-slate-200 bg-white px-3 py-2 hover:text-slate-950">Sign out</button></form>
          </nav>
        </header>
        {children}
      </div>
    </main>
  );
}

export function formatTripDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
