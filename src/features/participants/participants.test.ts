import { createHash } from "node:crypto";
import { addParticipant, cancelInvitation, removeParticipant, resendInvitation, respondToInvitation } from "@/features/participants/actions";
import { hashInvitationToken, isInvitationToken, newInvitationToken } from "@/features/participants/tokens";
import { sendInvitation, invitationMailSettings } from "@/features/participants/email";
import { validateParticipant } from "@/features/participants/validation";
import { initialAuthFormState } from "@/features/auth/form-state";
import { createClient } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));
jest.mock("@/features/participants/email", () => ({
  invitationMailSettings: jest.fn(),
  sendInvitation: jest.fn(),
}));

const mockCreateClient = jest.mocked(createClient);
const mockSettings = jest.mocked(invitationMailSettings);
const mockSend = jest.mocked(sendInvitation);
const tripId = "10000000-0000-4000-8000-000000000001";
const recordId = "10000000-0000-4000-8000-000000000002";
const token = "a".repeat(43);

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function client(user = true) {
  return {
    auth: { getClaims: jest.fn().mockResolvedValue(user
      ? { data: { claims: { sub: "verified-user" } }, error: null }
      : { data: null, error: { name: "AuthSessionMissingError" } }) },
    from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: jest.fn().mockResolvedValue({ data: { name: "Trip" }, error: null }) }) }) })),
    rpc: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSettings.mockReturnValue({ kind: "resend", origin: "https://example.test", from: "sender@example.test", apiKey: "test-key" });
});

it("generates secure random tokens and hashes without storing token text", () => {
  const first = newInvitationToken();
  const second = newInvitationToken();
  expect(isInvitationToken(first)).toBe(true);
  expect(first).not.toBe(second);
  expect(hashInvitationToken(first)).toBe(createHash("sha256").update(first).digest("hex"));
  expect(isInvitationToken(first + "x")).toBe(false);
});

it("validates and normalizes participant names and email addresses", () => {
  expect(validateParticipant(form({ name: " Ana ", email: " ANA@EXAMPLE.COM " }))).toEqual({
    success: true, data: { name: "Ana", email: "ana@example.com" },
  });
  expect(validateParticipant(form({ name: " ", email: "bad" })).success).toBe(false);
});

it("creates external participants only through the verified session and reports duplicates", async () => {
  const supabase = client();
  supabase.rpc.mockResolvedValueOnce({ data: recordId, error: null }).mockResolvedValueOnce({ data: null, error: { code: "23505" } });
  mockCreateClient.mockResolvedValue(supabase as never);
  const values = form({ name: "Ana", email: "ana@example.com", mode: "external", user_id: "attacker" });
  expect((await addParticipant(tripId, initialAuthFormState, values)).message).toContain("no");
  expect(supabase.rpc).toHaveBeenCalledWith("add_external_participant", { p_trip_id: tripId, p_name: "Ana", p_email: "ana@example.com" });
  expect((await addParticipant(tripId, initialAuthFormState, values)).message).toContain("already exists");
});

it("creates a hashed invitation and never claims failed email was sent", async () => {
  const supabase = client();
  supabase.rpc.mockResolvedValue({ data: recordId, error: null });
  mockCreateClient.mockResolvedValue(supabase as never);
  mockSend.mockResolvedValue({ sent: false });
  const result = await addParticipant(tripId, initialAuthFormState, form({ name: "Ana", email: "ana@example.com", mode: "invite" }));
  expect(result.message).toContain("could not be sent");
  const args = supabase.rpc.mock.calls[0][1] as { p_token_hash: string };
  expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
  const sentToken = mockSend.mock.calls[0][3];
  expect(hashInvitationToken(sentToken)).toBe(args.p_token_hash);
});

it("does not create an invitation when delivery is not configured", async () => {
  const supabase = client();
  mockCreateClient.mockResolvedValue(supabase as never);
  mockSettings.mockReturnValue({ kind: "unavailable", message: "Email is not configured." });
  const result = await addParticipant(tripId, initialAuthFormState, form({ name: "Ana", email: "ana@example.com", mode: "invite" }));
  expect(result.message).toContain("not configured");
  expect(supabase.rpc).not.toHaveBeenCalled();
});

it("reports development delivery accurately and rotates tokens when resending", async () => {
  const supabase = client();
  supabase.rpc.mockResolvedValue({ data: "ana@example.com", error: null });
  mockCreateClient.mockResolvedValue(supabase as never);
  mockSettings.mockReturnValue({ kind: "development", origin: "http://localhost:3000" });
  mockSend.mockResolvedValue({ sent: false, developmentLink: "http://localhost:3000/invitations#token=example" });
  const result = await resendInvitation(tripId, recordId, initialAuthFormState);
  expect(result.message).toContain("no email was sent");
  expect(result.developmentLink).toContain("#token=");
  expect(supabase.rpc).toHaveBeenCalledWith("resend_trip_invitation", expect.objectContaining({ p_trip_id: tripId, p_invitation_id: recordId, p_token_hash: expect.any(String) }));
});

it("rejects unauthenticated operations and handles cancellation and financial-history errors", async () => {
  const signedOut = client(false);
  mockCreateClient.mockResolvedValue(signedOut as never);
  expect((await cancelInvitation(tripId, recordId, initialAuthFormState)).message).toContain("session");
  expect(signedOut.rpc).not.toHaveBeenCalled();
  const supabase = client();
  mockCreateClient.mockResolvedValue(supabase as never);
  supabase.rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: "financial_history", error: null });
  expect((await cancelInvitation(tripId, recordId, initialAuthFormState)).status).toBe("success");
  expect((await removeParticipant(tripId, recordId, initialAuthFormState)).message).toContain("financial history");
});

it("sends the raw token only to the server-side atomic acceptance function and reports rejection", async () => {
  const supabase = client();
  mockCreateClient.mockResolvedValue(supabase as never);
  supabase.rpc.mockResolvedValue({ data: { status: "rejected" }, error: null });
  const result = await respondToInvitation(initialAuthFormState, form({ token, decision: "reject" }));
  expect(result.status).toBe("success");
  expect(supabase.rpc).toHaveBeenCalledWith("respond_to_trip_invitation", { p_token: token, p_accept: false });
});

it("returns the authorized trip on successful acceptance", async () => {
  const supabase = client();
  mockCreateClient.mockResolvedValue(supabase as never);
  supabase.rpc.mockResolvedValue({ data: { status: "accepted", trip_id: tripId }, error: null });
  const result = await respondToInvitation(initialAuthFormState, form({ token, decision: "accept" }));
  expect(result).toMatchObject({ status: "success", tripId });
});

it.each([
  ["expired", "expired"],
  ["used", "already been used"],
  ["email_mismatch", "different email"],
  ["unconfirmed", "Confirm your email"],
  ["conflict", "cannot be linked"],
])("provides an actionable message for %s", async (status, message) => {
  const supabase = client();
  mockCreateClient.mockResolvedValue(supabase as never);
  supabase.rpc.mockResolvedValue({ data: { status }, error: null });
  const result = await respondToInvitation(initialAuthFormState, form({ token, decision: "accept" }));
  expect(result.message).toContain(message);
});
