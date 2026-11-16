"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { addParticipant, cancelInvitation, removeParticipant, resendInvitation, type ParticipantFormState } from "@/features/participants/actions";

const fieldClass = "block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-700/10";
const buttonClass = "rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60";

function Feedback({ state }: { state: ParticipantFormState }) {
  const linkId = useId();
  return <>
    <FormFeedback state={state} />
    {state.developmentLink ? <div className="mt-3"><label htmlFor={linkId} className="block text-xs font-medium text-slate-700">Private development invitation link</label><input id={linkId} readOnly value={state.developmentLink} className={`${fieldClass} mt-1`} onFocus={(event) => event.currentTarget.select()} /></div> : null}
  </>;
}

function Submit({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={danger ? "rounded-lg border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60" : buttonClass}>{pending ? "Please wait…" : children}</button>;
}

export function AddParticipantForm({ tripId }: { tripId: string }) {
  const [state, action] = useActionState(addParticipant.bind(null, tripId), initialAuthFormState);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const errors = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-5 space-y-4 rounded-2xl bg-slate-50 p-4">
      <h3 className="font-semibold">Add a participant</h3>
      <Feedback state={state} />
      <FormField id="participant-name" label="Name" error={errors.name}>
        <input id="participant-name" name="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "participant-name-error" : undefined} className={fieldClass} />
      </FormField>
      <FormField id="participant-email" label="Email" error={errors.email}>
        <input id="participant-email" name="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "participant-email-error" : undefined} className={fieldClass} />
      </FormField>
      <fieldset className="space-y-2 text-sm text-slate-700">
        <legend className="mb-2 font-medium">Participant type</legend>
        <label className="flex items-start gap-2"><input type="radio" name="mode" value="invite" defaultChecked className="mt-1 accent-emerald-700" /> <span>Invite to TripSplit <span className="block text-xs text-slate-500">They can join after confirming their email.</span></span></label>
        <label className="flex items-start gap-2"><input type="radio" name="mode" value="external" className="mt-1 accent-emerald-700" /> <span>External participant <span className="block text-xs text-slate-500">For future expense splitting; no account access.</span></span></label>
      </fieldset>
      <Submit>Add participant</Submit>
    </form>
  );
}

export function InvitationControls({ tripId, invitationId }: { tripId: string; invitationId: string }) {
  const [resendState, resendAction] = useActionState(resendInvitation.bind(null, tripId, invitationId), initialAuthFormState);
  const [cancelState, cancelAction] = useActionState(cancelInvitation.bind(null, tripId, invitationId), initialAuthFormState);
  return <div className="mt-3 space-y-3">
    <Feedback state={resendState} /><Feedback state={cancelState} />
    <div className="flex flex-wrap items-start gap-2">
      <form action={resendAction}><Submit>Resend</Submit></form>
      <details className="text-sm"><summary className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700">Cancel invitation</summary>
        <form action={cancelAction} className="mt-2 space-y-2"><p className="text-xs text-slate-600">Cancel this invitation? The link will stop working.</p><Submit danger>Confirm cancellation</Submit></form>
      </details>
    </div>
  </div>;
}

export function RemoveParticipantControl({ tripId, participantId }: { tripId: string; participantId: string }) {
  const [state, action] = useActionState(removeParticipant.bind(null, tripId, participantId), initialAuthFormState);
  return <div className="mt-2"><Feedback state={state} /><details className="mt-2 text-sm">
    <summary className="cursor-pointer text-xs font-medium text-rose-700">Remove participant</summary>
    <form action={action} className="mt-2 space-y-2"><p className="text-xs text-slate-600">Remove this participant and cancel their invitations? Participants with financial history cannot be removed.</p><Submit danger>Confirm removal</Submit></form>
  </details></div>;
}
