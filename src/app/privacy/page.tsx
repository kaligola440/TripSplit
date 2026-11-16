import type { Metadata } from "next";
import { LegalShell } from "@/features/legal/legal-shell";

export const metadata: Metadata = { title: "Privacy | TripSplit" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>This draft describes the kinds of information the application is designed to process. It is not a complete privacy policy and must be reviewed against the service owner&apos;s actual operations and applicable law.</p>
      <section>
        <h2 className="font-semibold text-slate-950">Information used by TripSplit</h2>
        <p>Account information can include your email address, display name, and optional avatar URL. Trip records can include trip names, dates, currency, participant names and email addresses, expenses, notes, shares, and settlement history.</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-950">Service providers</h2>
        <p>Authentication and application data are handled through the configured Supabase project. When invitation email is enabled, invitation messages are sent through the configured Resend account. If an avatar URL is provided, the browser may request that image directly from its host.</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-950">Owner completion required</h2>
        <p>Before launch, identify the data controller and contact, purposes and legal bases, provider locations and transfer safeguards, retention periods, cookie or analytics behavior, user rights and request process, and the method for handling account and data deletion. Confirm these details with qualified privacy counsel.</p>
      </section>
    </LegalShell>
  );
}
