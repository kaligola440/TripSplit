import { createTrip, updateTrip } from "@/features/trips/actions";
import { validateTrip } from "@/features/trips/validation";
import { listTrips } from "@/features/trips/queries";
import { formatTripAmount, formatTripBalance, getTripScheduleStatus } from "@/features/trips/dashboard";
import { initialAuthFormState } from "@/features/auth/form-state";
import { createClient } from "@/lib/supabase/server";
import TripsPage from "@/app/trips/page";
import { revalidatePath } from "next/cache";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("next/navigation", () => ({
  redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); },
}));

const mockCreateClient = jest.mocked(createClient);
const tripId = "a39b3e31-39d2-4549-a3dd-72cc96c70181";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "  Summer trip  ", startDate: "2027-06-01", endDate: "2027-06-05",
    description: "  Together  ", currency: "eur", ...values,
  })) data.set(key, value);
  return data;
}

function client(userId: string | null = "verified-user") {
  return {
    auth: {
      getClaims: jest.fn().mockResolvedValue(userId
        ? { data: { claims: { sub: userId } }, error: null }
        : { data: null, error: { name: "AuthSessionMissingError" } }),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  };
}

describe("trip validation", () => {
  it("normalizes valid fields and allows an omitted end date and description", () => {
    expect(validateTrip(form({ endDate: "", description: "" }))).toEqual({
      success: true,
      data: { name: "Summer trip", description: null, start_date: "2027-06-01", end_date: null, currency: "EUR" },
    });
  });

  it("rejects missing fields, invalid calendar dates, currencies and long descriptions", () => {
    const result = validateTrip(form({ name: "  ", startDate: "", endDate: "2027-02-29", currency: "€", description: "a".repeat(5001) }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors).toMatchObject({
      name: expect.any(String), startDate: expect.any(String), endDate: expect.any(String),
      currency: expect.any(String), description: expect.any(String),
    });
  });

  it("rejects reversed date ranges for creation and updates", () => {
    const result = validateTrip(form({ startDate: "2027-06-10", endDate: "2027-06-09" }));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.fieldErrors.endDate).toContain("earlier");
  });
});

describe("trip actions and access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("trip dashboard queries", () => {
    it("loads additional dashboard pages rather than silently truncating the trip list", async () => {
      const supabase = client();
      const trip = {
        id: tripId, name: "Trip", start_date: "2027-01-01", end_date: null, currency: "EUR",
        participant_count: 2, total_expenses: "15.000001", net_balance: "-5.000001",
      };
      const range = jest.fn()
        .mockResolvedValueOnce({ data: Array(100).fill(trip), error: null })
        .mockResolvedValueOnce({ data: [trip], error: null });
      supabase.rpc.mockReturnValue({ range });
      const result = await listTrips(supabase as never);
      expect(result).toHaveLength(101);
      expect(supabase.rpc).toHaveBeenCalledWith("get_trip_dashboard", {});
      expect(range).toHaveBeenNthCalledWith(1, 0, 99);
      expect(range).toHaveBeenNthCalledWith(2, 100, 199);
    });

    it("surfaces query failures instead of returning an empty dashboard", async () => {
      const supabase = client();
      const range = jest.fn().mockResolvedValue({ data: null, error: { message: "provider detail" } });
      supabase.rpc.mockReturnValue({ range });
      await expect(listTrips(supabase as never)).rejects.toThrow("Unable to load trips.");
    });
  });

  it("classifies trips by dates and formats financial values without floating-point arithmetic", () => {
    const trip = { start_date: "2027-01-10", end_date: "2027-01-12" };
    expect(getTripScheduleStatus(trip, "2027-01-09")).toBe("upcoming");
    expect(getTripScheduleStatus(trip, "2027-01-10")).toBe("active");
    expect(getTripScheduleStatus(trip, "2027-01-12")).toBe("active");
    expect(getTripScheduleStatus(trip, "2027-01-13")).toBe("completed");
    expect(getTripScheduleStatus({ start_date: "2027-01-10", end_date: null }, "2027-02-01")).toBe("active");
    expect(formatTripAmount("0.100001", "EUR")).toBe("0.100001 EUR");
    expect(formatTripBalance("-12.000001", "EUR")).toEqual({ label: "You owe", amount: "12.000001 EUR" });
    expect(formatTripBalance("0.000000", "EUR")).toEqual({ label: "Settled", amount: "0 EUR" });
    expect(() => formatTripAmount("not-money", "EUR")).toThrow("Invalid monetary amount");
  });

  it("redirects unauthenticated dashboard access and rejects mutations", async () => {
    const supabase = client(null);
    mockCreateClient.mockResolvedValue(supabase as never);
    await expect(TripsPage()).rejects.toThrow("NEXT_REDIRECT:/login?error=required");
    const result = await createTrip(initialAuthFormState, form());
    expect(result.message).toContain("session has expired");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("creates a trip for the verified user and redirects to it", async () => {
    const supabase = client();
    const single = jest.fn().mockResolvedValue({ data: { id: tripId }, error: null });
    const select = jest.fn(() => ({ single }));
    const insert = jest.fn(() => ({ select }));
    supabase.from.mockReturnValue({ insert });
    mockCreateClient.mockResolvedValue(supabase as never);
    await expect(createTrip(initialAuthFormState, form({ created_by: "attacker" }))).rejects.toThrow(`NEXT_REDIRECT:/trips/${tripId}?created=1`);
    expect(insert).toHaveBeenCalledWith({
      name: "Summer trip", start_date: "2027-06-01", end_date: "2027-06-05",
      description: "Together", currency: "EUR", created_by: "verified-user",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/trips");
  });

  it("reports creation failure without exposing provider details", async () => {
    const supabase = client();
    const single = jest.fn().mockResolvedValue({ data: null, error: { message: "private details" } });
    supabase.from.mockReturnValue({ insert: () => ({ select: () => ({ single }) }) });
    mockCreateClient.mockResolvedValue(supabase as never);
    const result = await createTrip(initialAuthFormState, form());
    expect(result.status).toBe("error");
    expect(result.message).not.toContain("private details");
  });

  it("validates updates before querying and rejects invalid identifiers", async () => {
    const supabase = client();
    mockCreateClient.mockResolvedValue(supabase as never);
    expect((await updateTrip(tripId, initialAuthFormState, form({ endDate: "2027-01-01" }))).fieldErrors?.endDate).toContain("earlier");
    expect((await updateTrip("invalid", initialAuthFormState, form())).status).toBe("error");
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("restricts updates to the verified creator and handles RLS-denied or missing rows", async () => {
    const supabase = client();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn(() => ({ maybeSingle }));
    const eqOwner = jest.fn(() => ({ select }));
    const eqId = jest.fn(() => ({ eq: eqOwner }));
    const update = jest.fn(() => ({ eq: eqId }));
    supabase.from.mockReturnValue({ update });
    mockCreateClient.mockResolvedValue(supabase as never);
    const result = await updateTrip(tripId, initialAuthFormState, form({ created_by: "attacker" }));
    expect(eqId).toHaveBeenCalledWith("id", tripId);
    expect(eqOwner).toHaveBeenCalledWith("created_by", "verified-user");
    expect(result.message).toContain("cannot edit");
    expect(revalidatePath).not.toHaveBeenCalled();

    maybeSingle.mockResolvedValue({ data: { id: tripId }, error: null });
    const success = await updateTrip(tripId, initialAuthFormState, form());
    expect(success.status).toBe("success");
    expect(revalidatePath).toHaveBeenCalledWith(`/trips/${tripId}`);
    maybeSingle.mockResolvedValue({ data: null, error: { message: "private details" } });
    const failure = await updateTrip(tripId, initialAuthFormState, form());
    expect(failure.status).toBe("error");
    expect(failure.message).not.toContain("private details");
  });
});
