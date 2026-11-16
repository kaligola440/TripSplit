import { invitationMailSettings, sendInvitation } from "@/features/participants/email";

afterEach(() => {
  jest.restoreAllMocks();
});

it("offers a local development link without sending or logging an email", async () => {
  jest.replaceProperty(process, "env", { NODE_ENV: "development", TRIPSPLIT_APP_URL: "http://localhost:3000" });
  const settings = invitationMailSettings();
  expect(settings.kind).toBe("development");
  if (settings.kind !== "development") throw new Error("Expected development settings");
  const fetchSpy = jest.spyOn(global, "fetch");
  const result = await sendInvitation(settings, "person@example.com", "Trip", "secret");
  expect(result).toEqual({ sent: false, developmentLink: "http://localhost:3000/invitations#token=secret" });
  expect(fetchSpy).not.toHaveBeenCalled();
});

it("fails closed in production without a configured provider or valid origin", () => {
  jest.replaceProperty(process, "env", { NODE_ENV: "production", TRIPSPLIT_APP_URL: "https://example.test" });
  expect(invitationMailSettings().kind).toBe("unavailable");
  jest.replaceProperty(process, "env", { NODE_ENV: "production", TRIPSPLIT_APP_URL: "http://localhost:3000", RESEND_API_KEY: "key", INVITATION_FROM_EMAIL: "sender@example.com" });
  expect(invitationMailSettings().kind).toBe("unavailable");
});

it("reports provider rejection and network failures without exposing provider details", async () => {
  const settings = { kind: "resend" as const, origin: "https://example.test", apiKey: "key", from: "sender@example.com" };
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(new Response("", { status: 400 })).mockRejectedValueOnce(new Error("provider details"));
  expect(await sendInvitation(settings, "person@example.com", "Trip", "secret")).toEqual({ sent: false });
  expect(await sendInvitation(settings, "person@example.com", "Trip", "secret")).toEqual({ sent: false });
  expect(fetchSpy).toHaveBeenCalledTimes(2);
});

it("only reports provider acceptance after a successful response", async () => {
  const settings = { kind: "resend" as const, origin: "https://example.test", apiKey: "key", from: "sender@example.com" };
  const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 200 }));
  expect(await sendInvitation(settings, "person@example.com", "Trip", "secret")).toEqual({ sent: true });
  expect(fetchSpy).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST" }));
});
