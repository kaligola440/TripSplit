"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

const inputClassName =
  "block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 aria-[invalid=true]:border-rose-400";

export function TextInput({
  id,
  name,
  type = "text",
  placeholder,
  autoComplete,
  error,
  required = true,
  maxLength,
  defaultValue,
}: {
  id: string;
  name: string;
  type?: "text" | "email" | "url";
  placeholder?: string;
  autoComplete?: string;
  error?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
}) {
  const errorId = `${id}-error`;

  return (
    <input
      id={id}
      name={name}
      type={type}
      placeholder={placeholder}
      autoComplete={autoComplete}
      required={required}
      maxLength={maxLength}
      defaultValue={defaultValue}
      aria-invalid={Boolean(error)}
      aria-describedby={error ? errorId : undefined}
      className={inputClassName}
    />
  );
}

export function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  error,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  error?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = `${id}-error`;

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        maxLength={128}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`${inputClassName} pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-xl text-slate-500 transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        {visible ? (
          <EyeOff aria-hidden="true" size={18} />
        ) : (
          <Eye aria-hidden="true" size={18} />
        )}
      </button>
    </div>
  );
}

export function SubmitButton({
  children,
}: {
  children: ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-65"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={17} /> : null}
      {pending ? "Please wait…" : children}
    </button>
  );
}
