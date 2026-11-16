import type { ReactNode } from "react";

export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={errorId} className="mt-1.5 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
