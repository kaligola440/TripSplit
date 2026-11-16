export default function ProfileLoading() {
  return (
    <main aria-busy="true" className="min-h-screen bg-[#f7f8f6] px-5 py-10 sm:px-8">
      <p role="status" className="sr-only">Loading your profile…</p>
      <div aria-hidden="true" className="mx-auto max-w-5xl">
        <div className="h-12 animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-8 grid gap-8 md:grid-cols-[0.8fr_1.2fr]">
          <div className="h-80 animate-pulse rounded-3xl bg-white" />
          <div className="h-80 animate-pulse rounded-3xl bg-white" />
        </div>
      </div>
    </main>
  );
}
