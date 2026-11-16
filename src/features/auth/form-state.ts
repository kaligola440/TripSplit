export type AuthFormState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string>;
};

export const initialAuthFormState: AuthFormState = {
  status: "idle",
  message: "",
};

export function errorState(
  message: string,
  fieldErrors?: Record<string, string>,
): AuthFormState {
  return { status: "error", message, fieldErrors };
}

export function successState(message: string): AuthFormState {
  return { status: "success", message };
}
