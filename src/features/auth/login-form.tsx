"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn } from "lucide-react";
import { login } from "@/features/auth/actions";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { PasswordInput, SubmitButton, TextInput } from "@/features/auth/form-controls";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction] = useActionState(login, initialAuthFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-900">
          {notice}
        </div>
      ) : null}
      <FormFeedback state={state} />
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
          autoComplete="current-password"
          placeholder="Your password"
          error={fieldErrors.password}
        />
      </FormField>
      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-emerald-800 hover:text-emerald-950"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton>
        <LogIn aria-hidden="true" size={17} />
        Sign in
      </SubmitButton>
    </form>
  );
}
