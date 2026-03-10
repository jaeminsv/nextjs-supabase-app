import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

/**
 * OAuth callback route handler.
 *
 * After the user authenticates with Google (or any OAuth provider),
 * Supabase redirects back to this endpoint with a `code` query parameter.
 *
 * This route:
 * 1. Extracts the `code` from the URL
 * 2. Exchanges it for a session using `supabase.auth.exchangeCodeForSession()`
 *    — this sets the auth cookies so the user stays logged in
 * 3. Redirects to `/dashboard` on success, or `/auth/error` on failure
 *
 * Note: This is separate from `/auth/confirm` which handles email OTP verification.
 * OAuth and OTP use different flows, so they need separate routes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // The `code` parameter is provided by Supabase after successful OAuth authentication
  const code = searchParams.get("code");

  // The `next` parameter allows custom redirect destinations (defaults to /dashboard)
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    // Create a new Supabase server client (with cookies) for each request
    // — never reuse server clients across requests
    const supabase = await createClient();

    // Exchange the temporary code for a persistent session
    // This also sets the auth cookies automatically
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Success — redirect to the protected page (or custom destination)
      redirect(next);
    }

    // If code exchange failed, redirect to error page with the error message
    redirect(`/auth/error?error=${error.message}`);
  }

  // No code parameter — something went wrong with the OAuth flow
  redirect("/auth/error?error=No authorization code provided");
}
