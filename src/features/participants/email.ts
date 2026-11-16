import "server-only";

type MailSettings =
  | { kind: "resend"; origin: string; apiKey: string; from: string }
  | { kind: "development"; origin: string }
  | { kind: "unavailable"; message: string };

export function invitationMailSettings(): MailSettings {
  const originValue = process.env.TRIPSPLIT_APP_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  let origin: string;
  try {
    const url = new URL(originValue);
    if (url.origin !== originValue || url.username || url.password ||
      (url.protocol !== "https:" &&
        !(process.env.NODE_ENV === "development" && url.protocol === "http:" &&
          (url.hostname === "localhost" || url.hostname === "127.0.0.1")))) {
      return { kind: "unavailable", message: "Configure a valid application origin before sending invitations." };
    }
    origin = url.origin;
  } catch {
    return { kind: "unavailable", message: "Configure the application origin before sending invitations." };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITATION_FROM_EMAIL;
  if (apiKey && from) return { kind: "resend", origin, apiKey, from };
  if (process.env.NODE_ENV === "development" && !apiKey && !from) return { kind: "development", origin };
  return { kind: "unavailable", message: "Invitation email is not configured. Contact the application administrator." };
}

export async function sendInvitation(
  settings: Exclude<MailSettings, { kind: "unavailable" }>,
  recipient: string,
  tripName: string,
  token: string,
): Promise<{ sent: boolean; developmentLink?: string }> {
  const link = `${settings.origin}/invitations#token=${encodeURIComponent(token)}`;
  if (settings.kind === "development") return { sent: false, developmentLink: link };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${settings.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: settings.from,
        to: [recipient],
        subject: "You're invited to a trip on TripSplit",
        text: `You've been invited to join "${tripName}" on TripSplit.\n\nOpen this link to accept or decline:\n${link}\n\nThis link expires in 7 days. Sign in with the invited email address.`,
      }),
      cache: "no-store",
    });
    return { sent: response.ok };
  } catch {
    return { sent: false };
  }
}
