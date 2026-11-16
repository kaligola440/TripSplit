"use client";

export default function ExpenseError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="min-h-screen bg-[#f7f8f6] px-5 py-16 text-center">
    <div role="alert" className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-white p-8">
      <h1 className="text-xl font-semibold text-slate-950">We couldn&apos;t load these expenses</h1>
      <p className="mt-3 text-sm text-slate-600">Please check your connection and try again.</p>
      <button type="button" onClick={retry} className="mt-6 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">Try again</button>
    </div>
  </main>;
}
