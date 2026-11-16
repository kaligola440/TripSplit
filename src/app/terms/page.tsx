import type { Metadata } from "next";
import { LegalShell } from "@/features/legal/legal-shell";

export const metadata: Metadata = { title: "Terms | TripSplit" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>This is a placeholder, not a binding set of terms. Do not rely on it as a contract. The service owner must supply and obtain legal review of complete terms before inviting public use.</p>
      <section>
        <h2 className="font-semibold text-slate-950">Terms to be provided by the service owner</h2>
        <p>Define account eligibility and responsibilities, acceptable use, the status and accuracy of user-entered expense records, service availability, dispute handling, liability and warranty terms, suspension or termination, governing law, and effective date.</p>
      </section>
      <section>
        <h2 className="font-semibold text-slate-950">No financial transfer processing</h2>
        <p>TripSplit records shared expenses and settlements entered by participants. Confirm the application&apos;s exact payment-related behavior and any applicable disclosures with the service owner before publication.</p>
      </section>
    </LegalShell>
  );
}
