import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatPersonName } from "@/lib/person-name";
import { ExpenseForm } from "@/features/expenses/expense-form";
import { SettlementForm } from "@/features/balances/settlement-form";
import { TripFinancialsPanel } from "@/features/balances/trip-financials-panel";
import { calculateShares } from "@/features/expenses/splits";
import { parseTripFinancials } from "@/features/balances/financial-data";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import TripDetailPage from "@/app/trips/[id]/page";
import ExpenseDetailPage from "@/app/trips/[id]/expenses/[expenseId]/page";
import ProfilePage from "@/app/profile/page";

jest.mock("react", () => ({
  ...jest.requireActual("react"),
  useActionState: (_action: unknown, initialState: unknown) => [initialState, undefined, false],
}));
jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  useFormStatus: () => ({ pending: false }),
}));
jest.mock("@/features/auth/actions", () => ({ signOut: jest.fn(), updateProfile: jest.fn() }));
jest.mock("@/features/expenses/actions", () => ({ createExpense: jest.fn(), updateExpense: jest.fn(), deleteExpense: jest.fn() }));
jest.mock("@/features/participants/actions", () => ({
  addParticipant: jest.fn(), cancelInvitation: jest.fn(), removeParticipant: jest.fn(), resendInvitation: jest.fn(),
}));
jest.mock("@/features/balances/actions", () => ({ recordTripSettlement: jest.fn() }));
jest.mock("@/lib/supabase/auth", () => ({ requireAuthenticatedUser: jest.fn() }));
jest.mock("@/features/expenses/expense-list", () => ({ ExpenseList: () => null }));

const { ExpenseList } = jest.requireActual<typeof import("@/features/expenses/expense-list")>("@/features/expenses/expense-list");
const tripId = "00000000-0000-4000-8000-000000000001";
const expenseId = "00000000-0000-4000-8000-000000000002";
const participants = [
  { id: "00000000-0000-4000-8000-000000000003", user_id: "registered", display_name: "  Alberto \t Rossi ", role: "owner", status: "active", email: null },
  { id: "00000000-0000-4000-8000-000000000004", user_id: null, display_name: " Alberto   Bianchi ", role: "member", status: "active", email: null },
];
const rawFinancials = {
  participants: participants.map((participant, index) => ({
    ...participant,
    paid_amount: index === 0 ? "20" : "0",
    owed_amount: "10",
    settlements_paid: index === 1 ? "2" : "0",
    settlements_received: index === 0 ? "2" : "0",
  })),
  settlements: [{
    id: "payment", from_participant_id: participants[1].id, from_name: participants[1].display_name,
    to_participant_id: participants[0].id, to_name: participants[0].display_name,
    amount: "2", currency: "EUR", payment_date: "2027-01-02", notes: null, created_at: "2027-01-02",
  }],
};
const expense = {
  id: expenseId, trip_id: tripId, description: "Dinner", amount: "20", currency: "EUR", category: "food",
  expense_date: "2027-01-01", paid_by_participant_id: participants[0].id,
  payer_name: participants[0].display_name, notes: null, created_by: "registered",
  shares: participants.map((participant) => ({
    participant_id: participant.id, display_name: participant.display_name, email: null,
    share_amount: "10", share_type: "custom" as const, share_percentage: null,
  })),
};
const trip = { id: tripId, name: "Holiday", currency: "EUR", created_by: "registered", start_date: "2027-01-01", end_date: null };

function financials() {
  const result = parseTripFinancials(rawFinancials);
  if (!result) throw new Error("Invalid test financial data.");
  return result;
}

function client() {
  return {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: "registered", email: "member@example.com", created_at: "2027-01-01" } }, error: null }) },
    from: jest.fn((table: string) => {
      const data = table === "trips" ? trip : table === "profiles"
        ? { display_name: participants[0].display_name, avatar_url: null }
        : table === "trip_participants" ? participants : [];
      const query = {
        select: jest.fn(), eq: jest.fn(),
        order: jest.fn().mockResolvedValue({ data, error: null }),
        maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
        limit: jest.fn().mockResolvedValue({ data, error: null }),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }),
    rpc: jest.fn((name: string) => Promise.resolve({
      data: name === "get_trip_financials" ? rawFinancials : name === "get_expense_detail" ? expense : [{ ...expense, share_count: 2 }],
      error: null,
    })),
  };
}

describe("person-name display", () => {
  it("preserves complete names and legacy single names, normalizes whitespace, and handles absent values", () => {
    expect(formatPersonName(" \t Alberto \n Rossi  ")).toBe("Alberto Rossi");
    expect(formatPersonName("Alberto")).toBe("Alberto");
    expect(formatPersonName("  María   del Carmen O'Neill-Smith ")).toBe("María del Carmen O'Neill-Smith");
    for (const name of [null, undefined, "", " \t "]) {
      expect(formatPersonName(name)).toBe("TripSplit member");
      expect(formatPersonName(name, "member@example.com")).toBe("member@example.com");
    }
  });

  it.each([undefined, expense])("shows distinct full names in expense creation/edit payer, split, and share controls", (initialExpense) => {
    const markup = renderToStaticMarkup(createElement(ExpenseForm, {
      tripId, tripCurrency: "EUR", today: "2027-01-01", participants, expense: initialExpense,
    }));
    for (const [index, surname] of ["Rossi", "Bianchi"].entries()) {
      expect(markup).toContain(`<option value="${participants[index].id}"${index === 0 && initialExpense ? ' selected=""' : ""}>Alberto ${surname}</option>`);
      expect(markup).toContain(`break-words font-medium">Alberto ${surname}</span>`);
      if (initialExpense) expect(markup).toContain(`for="share-${participants[index].id}"`);
    }
    expect(markup).not.toContain("truncate");
  });

  it("keeps full names in split validation feedback", () => {
    expect(calculateShares("20", [{ id: "1", name: participants[0].display_name }], "custom", {}))
      .toMatchObject({ success: false, message: "Enter a valid non-negative share for Alberto Rossi." });
    expect(calculateShares("20", [{ id: "2", name: participants[1].display_name }], "percentage", {}))
      .toMatchObject({ success: false, message: expect.stringContaining("Alberto Bianchi.") });
  });

  it("shows both full names in settlement selectors, balance cards, suggestions, and history", () => {
    const data = financials();
    const form = renderToStaticMarkup(createElement(SettlementForm, {
      tripId, currency: "EUR", today: "2027-01-02", participants: data.participants,
    }));
    expect(form).toContain("Alberto Bianchi · owes 8 EUR");
    expect(form).toContain("Alberto Rossi · is owed 8 EUR");
    const panel = renderToStaticMarkup(createElement(TripFinancialsPanel, {
      tripId, currency: "EUR", financials: data, settlementRecorded: false,
    }));
    expect(panel).toContain(">Alberto Rossi</p>");
    expect(panel).toContain(">Alberto Bianchi</p>");
    expect(panel).toContain('>Alberto Bianchi</span><span class="text-slate-500"> pays </span><span class="font-semibold">Alberto Rossi</span>');
    expect(panel).toContain('>Alberto Bianchi</span><span class="text-slate-500"> paid </span><span class="font-semibold">Alberto Rossi</span>');
  });

  it("shows full names in expense list filters, payer labels, details, and beneficiary breakdown", async () => {
    const supabase = client();
    jest.mocked(requireAuthenticatedUser).mockResolvedValue({ supabase, userId: "registered" } as never);
    const list = renderToStaticMarkup(await ExpenseList({ supabase: supabase as never, tripId, query: {} }));
    expect(list).toContain("Paid by Alberto Rossi");
    expect(list).toContain(">Alberto Rossi</option>");
    expect(list).toContain(">Alberto Bianchi</option>");
    const detail = renderToStaticMarkup(await ExpenseDetailPage({
      params: Promise.resolve({ id: tripId, expenseId }), searchParams: Promise.resolve({}),
    }));
    expect(detail).toContain("Paid by Alberto Rossi");
    expect(detail).toContain(">Alberto Rossi</p>");
    expect(detail).toContain(">Alberto Bianchi</p>");
  });

  it("shows registered and external full names in participant/invitation management and the profile heading", async () => {
    const supabase = client();
    jest.mocked(requireAuthenticatedUser).mockResolvedValue({ supabase, userId: "registered" } as never);
    const detail = renderToStaticMarkup(await TripDetailPage({
      params: Promise.resolve({ id: tripId }), searchParams: Promise.resolve({}),
    }));
    expect(detail).toContain("Created by Alberto Rossi.");
    expect(detail).toContain(">Alberto Rossi</p>");
    expect(detail).toContain(">Alberto Bianchi</p>");
    const profile = renderToStaticMarkup(await ProfilePage({ searchParams: Promise.resolve({}) }));
    expect(profile).toMatch(/<h1[^>]*>Alberto Rossi<\/h1>/);
    expect(supabase.from).not.toHaveBeenCalledWith("auth.users");
  });
});
