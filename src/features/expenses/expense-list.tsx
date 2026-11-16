import Link from "next/link";
import { ArrowDownUp, Plus, ReceiptText, Search } from "lucide-react";
import type { createClient } from "@/lib/supabase/server";
import { formatDatabaseAmount } from "@/features/expenses/money";
import { expenseCategories, validateExpenseFilters } from "@/features/expenses/validation";
import { formatPersonName } from "@/lib/person-name";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function ExpenseList({
  supabase,
  tripId,
  query,
}: {
  supabase: SupabaseClient;
  tripId: string;
  query: Record<string, string | string[] | undefined>;
}) {
  const filters = validateExpenseFilters(query);
  const [{ data: expenses, error }, { data: payers, error: payerError }] = await Promise.all([
    supabase.rpc("list_trip_expenses", {
      p_trip_id: tripId,
      p_date_from: filters.dateFrom,
      p_date_to: filters.dateTo,
      p_category: filters.category,
      p_payer: filters.payer,
      p_search: filters.search,
      p_sort: filters.sort,
    }),
    supabase.from("trip_participants").select("id, display_name").eq("trip_id", tripId).eq("status", "active").order("display_name"),
  ]);
  if (error || payerError) throw new Error("Unable to load trip expenses.");
  return (
    <section aria-labelledby="expenses-title" className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 id="expenses-title" className="text-xl font-semibold">Expenses</h2><p className="mt-1 text-sm text-slate-600">Shared trip costs, with every split accounted for.</p></div>
        <Link href={`/trips/${tripId}/expenses/new`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900"><Plus aria-hidden="true" size={17} /> Add expense</Link>
      </div>
      <form method="get" className="mt-6 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-medium text-slate-700">Search description<input name="q" defaultValue={filters.search ?? ""} maxLength={120} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-xs font-medium text-slate-700">Category<select name="category" defaultValue={filters.category ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">All categories</option>{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-700">Paid by<select name="payer" defaultValue={filters.payer ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Anyone</option>{payers.map((payer) => <option key={payer.id} value={payer.id}>{formatPersonName(payer.display_name)}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-700">Sort by<select name="sort" defaultValue={filters.sort} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="date_desc">Newest date</option><option value="date_asc">Oldest date</option><option value="amount_desc">Highest amount</option><option value="amount_asc">Lowest amount</option></select></label>
        <label className="text-xs font-medium text-slate-700">From<input type="date" name="from" defaultValue={filters.dateFrom ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="text-xs font-medium text-slate-700">To<input type="date" name="to" defaultValue={filters.dateTo ?? ""} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" /></label>
        <button className="inline-flex items-center justify-center gap-2 self-end rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"><Search aria-hidden="true" size={16} /> Apply filters</button>
        <Link href={`/trips/${tripId}`} className="self-end px-3 py-2.5 text-center text-sm font-medium text-slate-600 hover:text-emerald-800">Clear filters</Link>
      </form>
      {!expenses.length ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
        <ReceiptText aria-hidden="true" size={28} className="mx-auto text-emerald-700" />
        <h3 className="mt-3 font-semibold">{filters.search || filters.category || filters.payer || filters.dateFrom || filters.dateTo ? "No expenses match these filters" : "No expenses yet"}</h3>
        <p className="mt-1 text-sm text-slate-600">{filters.search || filters.category || filters.payer || filters.dateFrom || filters.dateTo ? "Try changing or clearing the filters." : "Add the first shared expense for this trip."}</p>
        {!filters.search && !filters.category && !filters.payer && !filters.dateFrom && !filters.dateTo ? <Link href={`/trips/${tripId}/expenses/new`} className="mt-4 inline-flex items-center gap-2 font-semibold text-emerald-800"><Plus size={16} /> Add expense</Link> : null}
      </div> : <ul className="mt-5 divide-y divide-slate-100">{expenses.map((expense) => <li key={expense.id}>
        <Link href={`/trips/${tripId}/expenses/${expense.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl px-2 py-4 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700">
          <div className="min-w-0"><p className="break-words font-semibold text-slate-900">{expense.description}</p><p className="mt-1 break-words text-sm text-slate-500">{expense.expense_date} · {expense.category} · Paid by {formatPersonName(expense.payer_name)}</p><p className="mt-1 text-xs text-slate-500">{expense.share_count} {expense.share_count === 1 ? "person" : "people"} sharing</p></div>
          <span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold tabular-nums text-slate-900">{filters.sort.startsWith("amount") ? <ArrowDownUp aria-hidden="true" size={14} className="text-slate-400" /> : null}{formatDatabaseAmount(expense.amount)} {expense.currency}</span>
        </Link>
      </li>)}</ul>}
    </section>
  );
}
