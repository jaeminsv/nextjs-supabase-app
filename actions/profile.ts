"use server";

/**
 * Server Actions for profile management.
 *
 * These actions run on the server and can be called from Client Components.
 * They handle Supabase mutations that require authentication context.
 *
 * IMPORTANT: Do NOT call redirect() inside these functions.
 * When called from a Client Component's try-catch block, redirect() throws
 * a NEXT_REDIRECT error that gets swallowed as a regular error. Instead,
 * return a result object and let the calling component handle navigation.
 */

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { OnboardingFormData } from "@/lib/validations/onboarding";

/**
 * We use the Insert type for upsert because the Insert row requires `id` to be
 * a string (not optional), which matches what we provide. The Update type has
 * id as optional (string | undefined), which causes a type error in upsert().
 */
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

/**
 * Creates or updates the authenticated user's profile after onboarding.
 *
 * Uses upsert (not insert) because handle_new_auth_user trigger already
 * creates a stub row with full_name='' when the user first signs in via OAuth.
 * Upserting on conflict 'id' safely overwrites the stub with the real data.
 *
 * @param data - Validated onboarding form data (all fields from the wizard)
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function createProfile(
  data: OnboardingFormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated using getClaims() instead of getUser().
  // getClaims() reads the JWT from the cookie locally without a network round-trip,
  // which avoids Supabase Auth API rate limits (429) that getUser() can trigger.
  // RLS policies enforce authorization at the DB level as an additional safeguard.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (!claims) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Build the profile payload using the DB Insert type for type safety.
  // role is always set to 'pending' — admin must approve before member access.
  const profile: ProfileInsert = {
    id: claims.sub,
    email: claims.email ?? "",
    role: "pending",
    full_name: data.full_name,
    display_name: data.display_name,
    phone: data.phone,
    // Optional KAIST academic fields — null if not provided
    kaist_bs_year: data.kaist_bs_year ?? null,
    kaist_bs_major: data.kaist_bs_major ?? null,
    is_integrated_ms_phd: data.is_integrated_ms_phd,
    kaist_ms_year: data.kaist_ms_year ?? null,
    kaist_ms_major: data.kaist_ms_major ?? null,
    kaist_phd_year: data.kaist_phd_year ?? null,
    kaist_phd_major: data.kaist_phd_major ?? null,
    // Optional professional info
    company: data.company ?? null,
    job_title: data.job_title ?? null,
    venmo_handle: data.venmo_handle ?? null,
    zelle_handle: data.zelle_handle ?? null,
  };

  // upsert with onConflict:'id' to handle the stub row created by the trigger
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });

  if (upsertError) {
    console.error("createProfile upsert error:", upsertError);
    return { error: upsertError.message };
  }

  return { success: true };
}
