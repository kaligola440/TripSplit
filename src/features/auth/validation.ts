const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;
const PASSWORD_REQUIREMENTS =
  "Use at least 12 characters, including at least one letter and one number.";

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; fieldErrors: Record<string, string> };

export type RegistrationInput = {
  displayName: string;
  email: string;
  password: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type ProfileInput = {
  displayName: string;
  avatarUrl: string | null;
};

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validateEmail(value: string): string | null {
  if (!value) {
    return "Enter your email address.";
  }

  if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
    return "Enter a valid email address.";
  }

  return null;
}

function validateStrongPassword(value: string): string | null {
  if (value.length < 12 || value.length > MAX_PASSWORD_LENGTH) {
    return PASSWORD_REQUIREMENTS;
  }

  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return PASSWORD_REQUIREMENTS;
  }

  return null;
}

export function validateRegistration(
  formData: FormData,
): ValidationResult<RegistrationInput> {
  const displayName = formString(formData, "displayName").trim();
  const email = normalizeEmail(formString(formData, "email"));
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");
  const fieldErrors: Record<string, string> = {};

  if (!displayName || displayName.length > 80) {
    fieldErrors.displayName = "Enter a name between 1 and 80 characters.";
  }

  const emailError = validateEmail(email);
  if (emailError) {
    fieldErrors.email = emailError;
  }

  const passwordError = validateStrongPassword(password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (formData.get("acceptTerms") !== "on") {
    fieldErrors.acceptTerms = "Accept the terms to create an account.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return { success: true, data: { displayName, email, password } };
}

export function validateLogin(
  formData: FormData,
): ValidationResult<LoginInput> {
  const email = normalizeEmail(formString(formData, "email"));
  const password = formString(formData, "password");
  const fieldErrors: Record<string, string> = {};

  const emailError = validateEmail(email);
  if (emailError) {
    fieldErrors.email = emailError;
  }

  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    fieldErrors.password = "Enter your password.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return { success: true, data: { email, password } };
}

export function validateEmailAddress(
  formData: FormData,
): ValidationResult<{ email: string }> {
  const email = normalizeEmail(formString(formData, "email"));
  const emailError = validateEmail(email);

  if (emailError) {
    return { success: false, fieldErrors: { email: emailError } };
  }

  return { success: true, data: { email } };
}

export function validatePasswordReset(
  formData: FormData,
): ValidationResult<{ password: string }> {
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");
  const fieldErrors: Record<string, string> = {};
  const passwordError = validateStrongPassword(password);

  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  if (password !== confirmPassword) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return { success: true, data: { password } };
}

export function validateProfile(
  formData: FormData,
): ValidationResult<ProfileInput> {
  const displayName = formString(formData, "displayName").trim();
  const rawAvatarUrl = formString(formData, "avatarUrl").trim();
  const fieldErrors: Record<string, string> = {};
  let avatarUrl: string | null = rawAvatarUrl || null;

  if (!displayName || displayName.length > 80) {
    fieldErrors.displayName = "Enter a name between 1 and 80 characters.";
  }

  if (rawAvatarUrl.length > 2048) {
    fieldErrors.avatarUrl = "Avatar URLs must be 2,048 characters or fewer.";
  } else if (rawAvatarUrl) {
    try {
      const parsedUrl = new URL(rawAvatarUrl);
      if (parsedUrl.protocol !== "https:" || !parsedUrl.hostname) {
        fieldErrors.avatarUrl = "Enter a secure HTTPS image URL.";
      } else {
        avatarUrl = parsedUrl.toString();
      }
    } catch {
      fieldErrors.avatarUrl = "Enter a valid HTTPS image URL.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, fieldErrors };
  }

  return { success: true, data: { displayName, avatarUrl } };
}

export function buildAuthCallbackUrl(
  origin: string,
  destination: "/profile" | "/reset-password",
): string | null {
  try {
    const url = new URL(origin);
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (
      url.origin !== origin ||
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const callback = new URL("/auth/callback", url.origin);
    callback.searchParams.set("next", destination);
    return callback.toString();
  } catch {
    return null;
  }
}

export function getSafeAuthDestination(
  value: string | null,
): "/profile" | "/reset-password" {
  return value === "/reset-password" ? "/reset-password" : "/profile";
}

export function authErrorMessage(
  error: { code?: string },
  operation: "login" | "registration" | "password",
): string {
  if (error.code === "email_not_confirmed") {
    return "Confirm your email address before signing in. Check your inbox for the confirmation link.";
  }

  if (error.code === "invalid_credentials") {
    return "The email or password is incorrect.";
  }

  if (
    error.code === "over_request_rate_limit" ||
    error.code === "over_email_send_rate_limit"
  ) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  if (error.code === "weak_password") {
    return PASSWORD_REQUIREMENTS;
  }

  if (operation === "login") {
    return "We couldn't sign you in. Check your details and try again.";
  }

  if (operation === "registration") {
    return "We couldn't complete registration. Check your details or try signing in.";
  }

  return "We couldn't update your password. Please try again.";
}
