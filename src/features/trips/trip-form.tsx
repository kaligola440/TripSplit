"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { SubmitButton } from "@/features/auth/form-controls";
import { initialAuthFormState } from "@/features/auth/form-state";
import { createTrip, updateTrip } from "@/features/trips/actions";
import type { Database } from "@/types/database.types";

type Trip = Database["public"]["Tables"]["trips"]["Row"];

export function TripForm({ trip }: { trip?: Trip }) {
  const action = trip ? updateTrip.bind(null, trip.id) : createTrip;
  const [state, formAction] = useActionState(action, initialAuthFormState);
  const [name, setName] = useState(trip?.name ?? "");
  const [startDate, setStartDate] = useState(trip?.start_date ?? "");
  const [endDate, setEndDate] = useState(trip?.end_date ?? "");
  const [currency, setCurrency] = useState(trip?.currency ?? "EUR");
  const [description, setDescription] = useState(trip?.description ?? "");
  const errors = state.fieldErrors ?? {};
  const inputStyle = "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 aria-[invalid=true]:border-rose-400";
  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />
      <FormField id="name" label="Trip name" error={errors.name}>
        <input id="name" name="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "name-error" : undefined} placeholder="A memorable getaway" className={inputStyle} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="startDate" label="Start date" error={errors.startDate}>
          <input id="startDate" name="startDate" type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-invalid={Boolean(errors.startDate)} aria-describedby={errors.startDate ? "startDate-error" : undefined} className={inputStyle} />
        </FormField>
        <FormField id="endDate" label="End date (optional)" error={errors.endDate}>
          <input id="endDate" name="endDate" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? "endDate-error" : undefined} className={inputStyle} />
        </FormField>
      </div>
      <FormField id="currency" label="Currency code" error={errors.currency}>
        <input id="currency" name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)} required maxLength={3} aria-invalid={Boolean(errors.currency)} aria-describedby={errors.currency ? "currency-error" : undefined} className={inputStyle} />
        <p className="mt-1.5 text-xs text-slate-500">Three-letter currency code, for example EUR or USD.</p>
      </FormField>
      <FormField id="description" label="Description (optional)" error={errors.description}>
        <textarea id="description" name="description" rows={5} maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "description-error" : undefined} className={inputStyle} />
      </FormField>
      <SubmitButton><Save aria-hidden="true" size={17} />{trip ? "Save changes" : "Create trip"}</SubmitButton>
    </form>
  );
}
