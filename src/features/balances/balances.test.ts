import { calculateNetBalance, formatExactUnits, parseExactUnits, suggestSettlements } from "@/features/balances/balances";
import { validateSettlement } from "@/features/balances/validation";

const uuid = (suffix: string) => `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("trip balance arithmetic", () => {
  it("calculates paid, owed, sent and received totals exactly", () => {
    expect(calculateNetBalance({
      paidAmount: "100.000001",
      owedAmount: "60.000002",
      settlementsPaid: "10.000003",
      settlementsReceived: "5.000004",
    })).toBe("44.999998");
    expect(calculateNetBalance({
      paidAmount: "0",
      owedAmount: "1.000001",
      settlementsPaid: "0",
      settlementsReceived: "0",
    })).toBe("-1.000001");
    expect(parseExactUnits("-0.000001")).toBe(-1n);
    expect(formatExactUnits(-1n)).toBe("-0.000001");
  });

  it("generates deterministic exact transfers and excludes settled participants", () => {
    const participants = [
      { id: uuid("4"), name: "Gabriele", netBalance: "-70" },
      { id: uuid("3"), name: "Giorgia", netBalance: "-80" },
      { id: uuid("2"), name: "Michela", netBalance: "50" },
      { id: uuid("1"), name: "Alberto", netBalance: "100" },
      { id: uuid("5"), name: "Settled", netBalance: "0" },
    ];
    expect(suggestSettlements(participants)).toEqual([
      { fromParticipantId: uuid("3"), fromName: "Giorgia", toParticipantId: uuid("1"), toName: "Alberto", amount: "80" },
      { fromParticipantId: uuid("4"), fromName: "Gabriele", toParticipantId: uuid("1"), toName: "Alberto", amount: "20" },
      { fromParticipantId: uuid("4"), fromName: "Gabriele", toParticipantId: uuid("2"), toName: "Michela", amount: "50" },
    ]);
  });

  it("preserves fractional units, handles multiple counterparties and rejects inconsistent ledgers", () => {
    const participants = [
      { id: uuid("1"), name: "A", netBalance: "-0.000003" },
      { id: uuid("2"), name: "B", netBalance: "-0.000002" },
      { id: uuid("3"), name: "C", netBalance: "0.000001" },
      { id: uuid("4"), name: "D", netBalance: "0.000004" },
      { id: uuid("5"), name: "Zero", netBalance: "0" },
    ];
    const result = suggestSettlements(participants);
    expect(result.map(({ amount }) => amount)).toEqual(["0.000003", "0.000001", "0.000001"]);
    expect(result.reduce((sum, item) => sum + parseExactUnits(item.amount)!, 0n)).toBe(5n);
    expect(() => suggestSettlements([...participants, { id: uuid("6"), name: "Mismatch", netBalance: "0.000001" }])).toThrow("do not reconcile");
    expect(() => suggestSettlements([participants[0], participants[0]])).toThrow("Duplicate");
  });
});

describe("settlement form validation", () => {
  function form(values: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      fromParticipantId: uuid("1"),
      toParticipantId: uuid("2"),
      amount: "10.000001",
      paymentDate: "2027-01-31",
      notes: "",
      ...values,
    })) data.set(key, value);
    return data;
  }

  it("accepts exact positive decimal amounts and normalizes optional notes", () => {
    expect(validateSettlement(form({ notes: "  Paid back  " }))).toEqual({
      success: true,
      data: {
        fromParticipantId: uuid("1"),
        toParticipantId: uuid("2"),
        amount: "10.000001",
        paymentDate: "2027-01-31",
        notes: "Paid back",
      },
    });
  });

  it("rejects zero, negative, over-precision amounts, same participants and impossible dates", () => {
    expect(validateSettlement(form({ amount: "0" })).success).toBe(false);
    expect(validateSettlement(form({ amount: "-1" })).success).toBe(false);
    expect(validateSettlement(form({ amount: "1.0000001" })).success).toBe(false);
    expect(validateSettlement(form({ toParticipantId: uuid("1") })).success).toBe(false);
    expect(validateSettlement(form({ paymentDate: "2027-02-29" })).success).toBe(false);
  });
});
