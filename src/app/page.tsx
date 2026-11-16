import { ArrowRight, CircleUserRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f8f6] text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-36 -top-40 size-[30rem] rounded-full bg-emerald-100/60 blur-3xl"
      />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between border-b border-slate-200/80 py-5">
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark />
            <span className="text-lg font-semibold tracking-tight">
              Trip<span className="text-emerald-700">Split</span>
            </span>
          </Link>
          <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-medium text-slate-600 sm:text-sm">
            Better trips, together
          </span>
        </header>

        <section className="grid flex-1 items-center gap-14 py-16 md:grid-cols-[1.05fr_0.95fr] md:gap-16 md:py-24">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-700/10">
              <Sparkles aria-hidden="true" size={15} />
              Made for going places
            </div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Good trips.
              <br />
              <span className="text-emerald-700">Fair splits.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-600">
              Manage shared trips and expenses effortlessly.
            </p>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm font-medium text-slate-600">
              <span>Less planning stress</span>
              <span className="text-emerald-700" aria-hidden="true">
                /
              </span>
              <span>More time together</span>
            </div>
          </div>

          <aside
            aria-labelledby="welcome-title"
            className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.28)] sm:p-9"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-800">
                <CircleUserRound aria-hidden="true" size={23} strokeWidth={1.8} />
              </div>
              <div>
                <h2 id="welcome-title" className="font-semibold tracking-tight">
                  Welcome to TripSplit
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Your trips are better shared.
                </p>
              </div>
            </div>

            <div className="my-8 h-px bg-slate-100" />

            <p className="text-sm font-medium text-slate-700">
              A space for your future account
            </p>
            <Link
              href="/register"
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              Create your account
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-emerald-800 hover:text-emerald-950"
              >
                Sign in
              </Link>
            </p>
          </aside>
        </section>

        <footer className="border-t border-slate-200/80 py-5 text-center text-xs text-slate-500">
          Made for the trips worth remembering.
        </footer>
      </div>
    </main>
  );
}
