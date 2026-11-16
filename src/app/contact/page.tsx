import type { Metadata } from "next";
import { LegalShell } from "@/features/legal/legal-shell";

export const metadata: Metadata = { title: "Contact | TripSplit" };

export default function ContactPage() {
  return (
    <LegalShell title="Contact and support">
      <p>Support contact details have not been configured.</p>
      <section>
        <h2 className="font-semibold text-slate-950">Before launch</h2>
        <p>Add a monitored support email or other approved contact channel here. Identify who handles account, privacy, and security requests, and confirm the expected response process. Do not publish this page with the placeholder as the only support path.</p>
      </section>
      <p className="rounded-xl border border-slate-200 bg-white p-4 font-medium text-slate-800">[SERVICE OWNER: add a verified support contact before launch]</p>
    </LegalShell>
  );
}
