"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { requestPasswordReset } from "@/features/auth/actions";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { SubmitButton, TextInput } from "@/features/auth/form-controls";

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    requestPasswordReset,
    initialAuthFormState,
  );
  const emailError = state.fieldErrors?.email;

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />
      <FormField id="email" label="Email address" error={emailError}>
        <TextInput
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          maxLength={254}
          error={emailError}
        />
      </FormField>
      <SubmitButton>
        <Mail aria-hidden="true" size={17} />
        Send reset link
      </SubmitButton>
    </form>
  );
}
