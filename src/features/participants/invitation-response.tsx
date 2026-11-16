"use client";

import Link from "next/link";
import { useActionState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { respondToInvitation, type ParticipantFormState } from "@/features/participants/actions";

const initialState: ParticipantFormState = initialAuthFormState;

function subscribeToHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHash() { return window.location.hash; }
function getServerHash() { return null; }

function ResponseButtons() {
  const { pending } = useFormStatus();
  return <div className="flex flex-wrap gap-3">
    <button name="decision" value="accept" disabled={pending} className="rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{pending ? "Please wait…" : "Accept invitation"}</button>
    <button name="decision" value="reject" disabled={pending} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Decline</button>
  </div>;
}

export function InvitationResponse({ signedIn }: { signedIn: boolean }) {
  const hash = useSyncExternalStore(subscribeToHash, getHash, getServerHash);
  const [state, action] = useActionState(respondToInvitation, initialState);
  if (hash === null) return <p role="status" className="text-sm text-slate-600">Loading invitation…</p>;
  const token = new URLSearchParams(hash.slice(1)).get("token");
  if (!token) return <p role="alert" className="text-sm text-rose-800">This invitation link is invalid. Open the link from your invitation email again.</p>;
  if (!signedIn) return <div className="space-y-4 text-sm text-slate-600">
    <p>Sign in or create an account using the email address that received this invitation. After signing in and confirming your email, reopen the original invitation link.</p>
    <div className="flex flex-wrap gap-3"><Link href="/login" className="rounded-xl bg-emerald-800 px-5 py-3 font-semibold text-white">Sign in</Link><Link href="/register" className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700">Create account</Link></div>
  </div>;
  return <div className="space-y-4">
    <p className="text-sm leading-6 text-slate-600">Respond using the account whose confirmed email address received this invitation.</p>
    <FormFeedback state={state} />
    {state.tripId ? <Link href={`/trips/${state.tripId}`} className="inline-block text-sm font-semibold text-emerald-800 hover:underline">Open trip →</Link> : null}
    {state.status !== "success" ? <form action={action}><input type="hidden" name="token" value={token} /><ResponseButtons /></form> : null}
  </div>;
}
