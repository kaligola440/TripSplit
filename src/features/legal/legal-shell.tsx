import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

const links = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f8f6] px-5 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 py-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">Trip<span className="text-emerald-700">Split</span></span>
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-700 hover:text-emerald-800">Home</Link>
        </header>
        <article className="mx-auto max-w-3xl py-10 sm:py-16">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Information</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
          <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            Draft placeholder: the service owner must complete and review this information before public launch.
          </div>
          <div className="mt-8 space-y-6 text-sm leading-7 text-slate-700">
            {children}
          </div>
        </article>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 py-6 text-sm text-slate-600">
          <span>TripSplit</span>
          <nav aria-label="Legal and support" className="flex flex-wrap gap-x-5 gap-y-2">
            {links.map(({ href, label }) => <Link key={href} href={href} className="font-medium hover:text-emerald-800">{label}</Link>)}
          </nav>
        </footer>
      </div>
    </main>
  );
}
