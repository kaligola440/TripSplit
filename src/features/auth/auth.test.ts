import { beforeEach, describe, expect, it } from "@jest/globals";
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { GET as authCallback } from "@/app/auth/callback/route";
import {
  login,
  register,
  requestPasswordReset,
  resetPassword,
  signOut,
  updateProfile,
} from "@/features/auth/actions";
import { initialAuthFormState } from "@/features/auth/form-state";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import {
  authErrorMessage,
  buildAuthCallbackUrl,
  getSafeAuthDestination,
  validateLogin,
  validatePasswordReset,
  validateProfile,
  validateRegistration,
} from "@/features/auth/validation";

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(),
}));

jest.mock("next/headers", () => ({
  headers: jest.fn(),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  },
}));

const mockCreateClient = jest.mocked(createClient);
const mockHeaders = jest.mocked(headers);
const mockRevalidatePath = jest.mocked(revalidatePath);

function asyncMock() {
  return jest.fn<Promise<unknown>, unknown[]>();
}

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

function createSupabaseMock() {
  return {
    auth: {
      getClaims: asyncMock().mockResolvedValue({
        data: { claims: { sub: "verified-user" } },
        error: null,
      }),
      signUp: asyncMock(),
      signInWithPassword: asyncMock(),
      signOut: asyncMock(),
      updateUser: asyncMock(),
      resetPasswordForEmail: asyncMock(),
      getUser: asyncMock(),
      exchangeCodeForSession: asyncMock(),
    },
    from: jest.fn<unknown, unknown[]>(),
  };
}

const validRegistration = {
  displayName: "Alex Traveler",
  email: "  Alex@Example.com ",
  password: "SafePassword2026",
  confirmPassword: "SafePassword2026",
  acceptTerms: "on",
};

describe("authentication validation", () => {
  it("validates registration fields, normalizes email, and requires terms acceptance", () => {
    const valid = validateRegistration(formData(validRegistration));
    expect(valid).toEqual({
      success: true,
      data: {
        displayName: "Alex Traveler",
        email: "alex@example.com",
        password: "SafePassword2026",
      },
    });

    const invalid = validateRegistration(
      formData({
        ...validRegistration,
        email: "not-an-email",
        password: "short",
        confirmPassword: "different",
        acceptTerms: "",
      }),
    );
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.fieldErrors).toMatchObject({
        email: expect.any(String),
        password: expect.any(String),
        confirmPassword: "Passwords do not match.",
        acceptTerms: expect.any(String),
      });
    }
  });

  it("allows existing passwords at login but validates password reset confirmation", () => {
    expect(
      validateLogin(formData({ email: "person@example.com", password: "oldpass" }))
        .success,
    ).toBe(true);

    const reset = validatePasswordReset(
      formData({
        password: "SafePassword2026",
        confirmPassword: "OtherPassword2026",
      }),
    );
    expect(reset.success).toBe(false);
    if (!reset.success) {
      expect(reset.fieldErrors.confirmPassword).toBe("Passwords do not match.");
    }
  });

  it("rejects unsafe avatar URLs and permits secure HTTPS URLs", () => {
    const insecure = validateProfile(
      formData({ displayName: "Alex", avatarUrl: "javascript:alert(1)" }),
    );
    expect(insecure.success).toBe(false);

    const secure = validateProfile(
      formData({
        displayName: "Alex",
        avatarUrl: "https://images.example.com/alex.png",
      }),
    );
    expect(secure).toEqual({
      success: true,
      data: {
        displayName: "Alex",
        avatarUrl: "https://images.example.com/alex.png",
      },
    });
  });

  it("limits auth callback destinations and rejects untrusted origins", () => {
    expect(
      buildAuthCallbackUrl("https://trips.example", "/reset-password"),
    ).toBe(
      "https://trips.example/auth/callback?next=%2Freset-password",
    );
    expect(buildAuthCallbackUrl("https://attacker.example/path", "/profile")).toBe(
      null,
    );
    expect(getSafeAuthDestination("//attacker.example")).toBe("/profile");
  });

  it("maps authentication failures to safe, actionable messages", () => {
    expect(
      authErrorMessage({ code: "invalid_credentials" }, "login"),
    ).toBe("The email or password is incorrect.");
    expect(
      authErrorMessage({ code: "email_not_confirmed" }, "login"),
    ).toContain("Confirm your email address");
    expect(authErrorMessage({}, "login")).not.toContain("undefined");
  });
});

describe("server authentication actions", () => {
  beforeEach(() => {
    mockCreateClient.mockReset();
    mockHeaders.mockResolvedValue(
      new Headers({ origin: "http://localhost:3000" }) as never,
    );
    mockRevalidatePath.mockReset();
  });

  it("sends registration metadata to the existing profile trigger", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { id: "new-user" }, session: null },
      error: null,
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await register(
      initialAuthFormState,
      formData(validRegistration),
    );

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alex@example.com",
        password: "SafePassword2026",
        options: expect.objectContaining({
          data: { display_name: "Alex Traveler" },
          emailRedirectTo:
            "http://localhost:3000/auth/callback?next=%2Fprofile",
        }),
      }),
    );
    expect(result.status).toBe("success");
  });

  it("handles invalid credentials without exposing provider details", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "invalid_credentials", message: "provider detail" },
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await login(
      initialAuthFormState,
      formData({ email: "person@example.com", password: "correct-horse" }),
    );

    expect(result.message).toBe("The email or password is incorrect.");
    expect(result.message).not.toContain("provider detail");
  });

  it("requires a verified session before accessing a protected route", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.getClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError" },
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    await expect(requireAuthenticatedUser()).rejects.toThrow(
      "NEXT_REDIRECT:/login?error=required",
    );
  });

  it("recognizes a verified Supabase session claim", async () => {
    const supabase = createSupabaseMock();
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await requireAuthenticatedUser();

    expect(result.userId).toBe("verified-user");
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1);
  });

  it("signs out and redirects through the Supabase session client", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.signOut.mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue(supabase as never);

    await expect(signOut()).rejects.toThrow(
      "NEXT_REDIRECT:/login?status=signed-out",
    );
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("updates only the verified user's existing profile row", async () => {
    const supabase = createSupabaseMock();
    const maybeSingle = jest.fn().mockResolvedValue({
      data: { id: "verified-user" },
      error: null,
    });
    const select = jest.fn(() => ({ maybeSingle }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ update });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await updateProfile(
      initialAuthFormState,
      formData({
        id: "attacker-controlled-id",
        displayName: "Alex Updated",
        avatarUrl: "",
      }),
    );

    expect(update).toHaveBeenCalledWith({
      display_name: "Alex Updated",
      avatar_url: null,
    });
    expect(eq).toHaveBeenCalledWith("id", "verified-user");
    expect(result.status).toBe("success");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("sends a reset email to the safe callback without revealing account existence", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await requestPasswordReset(
      initialAuthFormState,
      formData({ email: "Alex@Example.com" }),
    );

    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "alex@example.com",
      {
        redirectTo:
          "http://localhost:3000/auth/callback?next=%2Freset-password",
      },
    );
    expect(result.status).toBe("success");
    expect(result.message).not.toContain("alex@example.com");
  });

  it("rejects password reset when the callback session is missing", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.getClaims.mockResolvedValue({
      data: null,
      error: { name: "AuthSessionMissingError" },
    });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await resetPassword(
      initialAuthFormState,
      formData({
        password: "SafePassword2026",
        confirmPassword: "SafePassword2026",
      }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("invalid or has expired");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("does not create a replacement profile when the trigger-created row is missing", async () => {
    const supabase = createSupabaseMock();
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn(() => ({ maybeSingle }));
    const eq = jest.fn(() => ({ select }));
    const update = jest.fn(() => ({ eq }));
    supabase.from.mockReturnValue({ update });
    mockCreateClient.mockResolvedValue(supabase as never);

    const result = await updateProfile(
      initialAuthFormState,
      formData({ displayName: "Alex", avatarUrl: "" }),
    );

    expect(result.status).toBe("error");
    expect(result.message).toContain("No profile record was created");
    expect(update).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });

  it("exchanges callback codes and redirects only to the allowlisted route", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue(supabase as never);

    const response = await authCallback(
      new NextRequest(
        "https://trips.example/auth/callback?code=one-time-code&next=%2Freset-password",
      ),
    );

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "one-time-code",
    );
    expect(response.headers.get("location")).toBe(
      "https://trips.example/reset-password",
    );
  });

  it("maps failed recovery callback links to a safe expired-link page", async () => {
    const response = await authCallback(
      new NextRequest(
        "https://trips.example/auth/callback?error_code=otp_expired&next=%2Freset-password",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://trips.example/reset-password?error=expired",
    );
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
