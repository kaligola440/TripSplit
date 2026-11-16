import { NextResponse, type NextRequest } from "next/server";
import { getSafeAuthDestination } from "@/features/auth/validation";
import { createClient } from "@/lib/supabase/server";

function callbackFailure(request: NextRequest, destination: string) {
  const target =
    destination === "/reset-password"
      ? "/reset-password?error=expired"
      : "/login?error=confirmation";

  return NextResponse.redirect(new URL(target, request.url));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const destination = getSafeAuthDestination(
    requestUrl.searchParams.get("next"),
  );

  if (
    requestUrl.searchParams.has("error") ||
    requestUrl.searchParams.has("error_code")
  ) {
    return callbackFailure(request, destination);
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return callbackFailure(request, destination);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return callbackFailure(request, destination);
  }

  const target =
    destination === "/reset-password"
      ? destination
      : "/profile?confirmed=1";

  return NextResponse.redirect(new URL(target, request.url));
}
