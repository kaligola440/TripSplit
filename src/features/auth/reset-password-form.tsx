"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { resetPassword } from "@/features/auth/actions";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { PasswordInput, SubmitButton } from "@/features/auth/form-controls";

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(resetPassword, initialAuthFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />
      <FormField id="password" label="New password" error={fieldErrors.password}>
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
        label="Confirm new password"
        error={fieldErrors.confirmPassword}
      >
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={12}
          placeholder="Enter your new password again"
          error={fieldErrors.confirmPassword}
        />
      </FormField>
      <SubmitButton>
        <KeyRound aria-hidden="true" size={17} />
        Update password
      </SubmitButton>
    </form>
  );
}
