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

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { OnboardingFormData } from "@/lib/validations/onboarding";

/**
 * Fields that a user is allowed to update after onboarding.
 * full_name, email, role, and created_at are intentionally excluded:
 *   - full_name: immutable after onboarding (policy decision)
 *   - email: managed by Supabase Auth, not the profiles table
 *   - role: changed only by admins via member management actions
 *   - created_at: set by the database on insert
 */
export interface ProfileUpdateData {
  display_name?: string;
  phone?: string;
  kaist_bs_year?: number | null;
  kaist_bs_major?: string | null;
  is_integrated_ms_phd?: boolean;
  kaist_ms_year?: number | null;
  kaist_ms_major?: string | null;
  kaist_phd_year?: number | null;
  kaist_phd_major?: string | null;
  company?: string | null;
  job_title?: string | null;
}

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

  // Use getUser() to verify the user against the Supabase Auth server.
  // Unlike getClaims() which only parses the local JWT (no network call),
  // getUser() makes an HTTP request to confirm the user still exists in auth.users.
  // This prevents a race condition where an admin deletes a user during onboarding:
  // the deleted user's JWT stays valid in the browser, but getUser() will return null,
  // so we catch the FK violation before it reaches the database.
  // createProfile is only called once per user (onboarding submit), so rate limits are not a concern.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    return {
      error: "계정이 존재하지 않습니다. 새로 회원가입 후 다시 시도해주세요.",
    };
  }

  // Build the profile payload using the DB Insert type for type safety.
  // role is always set to 'pending' — admin must approve before member access.
  const profile: ProfileInsert = {
    id: user.id,
    email: user.email ?? "",
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
  };

  // upsert with onConflict:'id' to handle the stub row created by the trigger
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id" });

  if (upsertError) {
    console.error("createProfile upsert error:", upsertError);
    return { error: "프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요." };
  }

  return { success: true };
}

/**
 * Updates the authenticated user's own profile with the provided fields.
 *
 * Only the fields listed in ProfileUpdateData can be changed.
 * full_name is immutable after onboarding (policy decision).
 * The user can only update their own profile — the WHERE clause uses
 * the authenticated user's ID from the JWT, not a user-supplied ID.
 *
 * @param data - Partial profile fields to update
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function updateProfile(
  data: ProfileUpdateData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated using getClaims() instead of getUser().
  // getClaims() reads the JWT from the cookie locally without a network round-trip,
  // which avoids Supabase Auth API rate limits (429) that getUser() can trigger.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Update only the provided fields. The .eq('id', userId) ensures users
  // can only update their own profile — not anyone else's.
  const { error: updateError } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId);

  if (updateError) {
    console.error("updateProfile error:", updateError);
    return { error: updateError.message };
  }

  // Revalidate the profile page so the updated data is shown immediately
  revalidatePath("/profile");
  return { success: true };
}
