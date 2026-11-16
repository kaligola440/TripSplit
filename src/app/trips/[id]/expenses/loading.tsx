export default function LoadingExpenses() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#f7f8f6] px-5 py-16 text-center text-sm text-slate-600">
      <p role="status">Loading expense details…</p>
      <div aria-hidden="true" className="mx-auto mt-8 h-56 max-w-5xl animate-pulse rounded-3xl border border-slate-200 bg-white" />
    </main>
  );
}
