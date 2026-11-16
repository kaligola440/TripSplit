import type { AuthFormState } from "@/features/auth/form-state";

export function FormFeedback({ state }: { state: AuthFormState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  const colors =
    state.status === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${colors}`}
    >
      {state.message}
    </div>
  );
}
