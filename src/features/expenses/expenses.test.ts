import { calculateShares } from "@/features/expenses/splits";
import { formatDatabaseAmount, formatUnits, parseMoney, parsePercentage } from "@/features/expenses/money";
import { validateExpense, validateExpenseFilters } from "@/features/expenses/validation";

const participants = [
  { id: "00000000-0000-4000-8000-000000000003", name: "Casey" },
  { id: "00000000-0000-4000-8000-000000000001", name: "Alex" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Jordan" },
];

function form(values: Record<string, string>, participantIds: string[] = [participants[0].id]) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    description: "Dinner", amount: "10.000001", expenseDate: "2027-01-02",
    category: "food", payerId: participants[0].id, splitMethod: "equal",
    currency: "EUR", ...values,
  })) result.set(key, value);
  for (const id of participantIds) result.append("participantIds", id);
  return result;
}

describe("exact expense arithmetic", () => {
  it("parses and formats numeric(20,6) decimal strings without floating point", () => {
    expect(parseMoney("99999999999999.999999")).toBe(99_999_999_999_999_999_999n);
    expect(parseMoney("0.000001")).toBe(1n);
    expect(parseMoney("1.0000001")).toBeNull();
    expect(parseMoney("-1")).toBeNull();
    expect(parsePercentage("100.000001")).toBeNull();
    expect(parsePercentage("33.333333")).toBe(33_333_333n);
    expect(formatUnits(5_000_001n)).toBe("5.000001");
    expect(formatDatabaseAmount("120.340000")).toBe("120.34");
    expect(() => formatDatabaseAmount("1e3")).toThrow("Invalid database");
  });

  it("splits equal amounts deterministically by participant UUID and conserves every unit", () => {
    const result = calculateShares("10.000001", participants, "equal", {});
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.shares.map(({ participant_id, share_amount }) => [participant_id, share_amount])).toEqual([
      [participants[1].id, "3.333333"],
      [participants[2].id, "3.333333"],
      [participants[0].id, "3.333335"],
    ]);
    expect(result.shares.reduce((sum, share) => sum + parseMoney(share.share_amount)!, 0n)).toBe(parseMoney("10.000001"));
  });

  it("validates custom amounts exactly including zero shares", () => {
    const values = { [participants[0].id]: "0", [participants[1].id]: "5.000001", [participants[2].id]: "5" };
    const result = calculateShares("10.000001", participants, "custom", values);
    expect(result.success).toBe(true);
    expect(calculateShares("10.000001", participants, "custom", { ...values, [participants[0].id]: "0.000001" })).toMatchObject({
      success: false, message: "Custom shares must add up exactly to the expense total.",
    });
    expect(calculateShares("1", participants, "custom", { ...values, [participants[0].id]: "-1" }).success).toBe(false);
  });

  it("validates percentages and applies the database's sorted, final-share remainder rule", () => {
    const values = { [participants[0].id]: "33.333333", [participants[1].id]: "33.333333", [participants[2].id]: "33.333334" };
    const result = calculateShares("10.000001", participants, "percentage", values);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.shares.map((share) => [share.participant_id, share.share_amount])).toEqual([
      [participants[1].id, "3.333333"],
      [participants[2].id, "3.333333"],
      [participants[0].id, "3.333335"],
    ]);
    expect(result.shares.reduce((sum, share) => sum + parseMoney(share.share_amount)!, 0n)).toBe(parseMoney("10.000001"));
    expect(calculateShares("10", participants, "percentage", { ...values, [participants[0].id]: "33.333332" }).success).toBe(false);
  });

  it("rejects empty participant sets, zero/negative totals, duplicate participants and excess precision", () => {
    expect(calculateShares("0", participants, "equal", {}).success).toBe(false);
    expect(calculateShares("-1", participants, "equal", {}).success).toBe(false);
    expect(calculateShares("1.0000001", participants, "equal", {}).success).toBe(false);
    expect(calculateShares("1", [], "equal", {}).success).toBe(false);
    expect(calculateShares("1", [participants[0], participants[0]], "equal", {}).success).toBe(false);
  });
});

describe("expense form validation", () => {
  const active = participants.map(({ id, name }) => ({ id, name }));

  it("accepts an external payer who is not in the share set", () => {
    expect(validateExpense(form({ splitMethod: "custom", [ `amount-${participants[0].id}` ]: "10.000001" }, [participants[0].id]), active, "EUR").success).toBe(true);
  });

  it("rejects unknown/inactive payer IDs, empty active participant lists, and invalid amounts", () => {
    expect(validateExpense(form({}), active, "EUR").success).toBe(true);
    expect(validateExpense(form({ amount: "0" }), active, "EUR").success).toBe(false);
    expect(validateExpense(form({ payerId: "10000000-0000-4000-8000-000000000099" }), active, "EUR").success).toBe(false);
    expect(validateExpense(form({}), [], "EUR").success).toBe(false);
  });
});

it("normalizes list filters and rejects unsafe sort, date, and participant parameters", () => {
  expect(validateExpenseFilters({ from: "2027-02-29", category: "unknown", payer: "1", sort: "random", q: "Dinner" })).toEqual({
    dateFrom: null, dateTo: null, category: null, payer: null, search: "Dinner", sort: "date_desc",
  });
});
