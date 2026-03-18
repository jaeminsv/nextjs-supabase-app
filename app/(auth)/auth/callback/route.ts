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
 * 3. Inspects the user's profile to determine the correct redirect destination:
 *    - full_name === '' (stub) → /onboarding (new user, needs to complete profile)
 *    - role === 'pending'     → /pending (waiting for admin approval)
 *    - else                  → /dashboard (approved member or admin)
 *
 * Note: This is separate from `/auth/confirm` which handles email OTP verification.
 * OAuth and OTP use different flows, so they need separate routes.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // The `code` parameter is provided by Supabase after successful OAuth authentication
  const code = searchParams.get("code");

  if (code) {
    // Create a new Supabase server client (with cookies) for each request
    // — never reuse server clients across requests
    const supabase = await createClient();

    // Exchange the temporary code for a persistent session.
    // This also sets the auth cookies automatically.
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Retrieve the now-authenticated user to look up their profile
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Check the profile created by the handle_new_auth_user trigger.
        // The trigger inserts a stub with full_name='' on first OAuth sign-in.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", user.id)
          .single();

        // New user: no profile yet, or stub profile with empty full_name
        if (!profile || profile.full_name === "") {
          redirect("/onboarding");
        }

        // Existing user awaiting admin approval
        if (profile.role === "pending") {
          redirect("/pending");
        }
      }

      // Approved member or admin — go to dashboard
      redirect("/dashboard");
    }

    // If code exchange failed, redirect to error page with the error message
    redirect(`/auth/error?error=${error.message}`);
  }

  // No code parameter — something went wrong with the OAuth flow
  redirect("/auth/error?error=No authorization code provided");
}
