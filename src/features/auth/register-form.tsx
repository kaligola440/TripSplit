"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { register } from "@/features/auth/actions";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { PasswordInput, SubmitButton, TextInput } from "@/features/auth/form-controls";

export function RegisterForm() {
  const [state, formAction] = useActionState(register, initialAuthFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />
      <FormField id="displayName" label="Full name" error={fieldErrors.displayName}>
        <TextInput
          id="displayName"
          name="displayName"
          placeholder="Your name"
          autoComplete="name"
          maxLength={80}
          error={fieldErrors.displayName}
        />
      </FormField>
      <FormField id="email" label="Email address" error={fieldErrors.email}>
        <TextInput
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={254}
          error={fieldErrors.email}
        />
      </FormField>
      <FormField id="password" label="Password" error={fieldErrors.password}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={12}
          placeholder="At least 12 characters"
          error={fieldErrors.password}
        />
      </FormField>
      <FormField
        id="confirmPassword"
        label="Confirm password"
        error={fieldErrors.confirmPassword}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={12}
          placeholder="Enter your password again"
          error={fieldErrors.confirmPassword}
        />
      </FormField>
      <div>
        <label className="flex items-start gap-3 text-sm leading-6 text-slate-600">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            aria-invalid={Boolean(fieldErrors.acceptTerms)}
            aria-describedby={fieldErrors.acceptTerms ? "acceptTerms-error" : undefined}
            className="mt-1 size-4 rounded border-slate-300 accent-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          />
          <span>
            I agree to TripSplit&apos;s Terms of Service and Privacy Policy.
          </span>
        </label>
        {fieldErrors.acceptTerms ? (
          <p id="acceptTerms-error" className="mt-1.5 text-xs text-rose-700">
            {fieldErrors.acceptTerms}
          </p>
        ) : null}
      </div>
      <SubmitButton>
        <CheckCircle2 aria-hidden="true" size={17} />
        Create account
      </SubmitButton>
    </form>
  );
}
