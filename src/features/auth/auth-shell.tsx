import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function AuthShell({
  title,
  description,
  footer,
  children,
}: {
  title: string;
  description: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#f7f8f6] px-5 text-slate-950 sm:px-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-40 size-[30rem] rounded-full bg-emerald-100/60 blur-3xl"
      />
      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between border-b border-slate-200/80 py-5">
        <Link href="/" className="inline-flex items-center gap-3">
          <BrandMark />
          <span className="text-lg font-semibold tracking-tight">
            Trip<span className="text-emerald-700">Split</span>
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 transition hover:text-emerald-800"
        >
          Back to home
        </Link>
      </header>

      <section className="relative flex flex-1 items-center justify-center py-12 sm:py-16">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)] sm:p-9">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
          {children}
          {footer ? (
            <div className="mt-7 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
              {footer}
            </div>
          ) : null}
        </div>
      </section>

      <footer className="relative mx-auto w-full max-w-7xl border-t border-slate-200/80 py-5 text-center text-xs text-slate-500">
        Made for the trips worth remembering.
      </footer>
    </main>
  );
}
