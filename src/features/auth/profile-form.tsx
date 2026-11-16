"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateProfile } from "@/features/auth/actions";
import { FormField } from "@/features/auth/form-field";
import { FormFeedback } from "@/features/auth/form-feedback";
import { initialAuthFormState } from "@/features/auth/form-state";
import { SubmitButton, TextInput } from "@/features/auth/form-controls";

export function ProfileForm({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string;
}) {
  const [state, formAction] = useActionState(updateProfile, initialAuthFormState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormFeedback state={state} />
      <FormField
        id="displayName"
        label="Full name"
        error={fieldErrors.displayName}
      >
        <TextInput
          id="displayName"
          name="displayName"
          defaultValue={displayName}
          autoComplete="name"
          maxLength={80}
          error={fieldErrors.displayName}
        />
      </FormField>
      <FormField
        id="avatarUrl"
        label="Avatar image URL"
        error={fieldErrors.avatarUrl}
      >
        <TextInput
          id="avatarUrl"
          name="avatarUrl"
          type="url"
          placeholder="https://example.com/photo.jpg"
          defaultValue={avatarUrl}
          autoComplete="url"
          maxLength={2048}
          required={false}
          error={fieldErrors.avatarUrl}
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          Use a publicly accessible HTTPS image. Your browser will load it from
          that address.
        </p>
      </FormField>
      <SubmitButton>
        <Save aria-hidden="true" size={17} />
        Save changes
      </SubmitButton>
    </form>
  );
}
