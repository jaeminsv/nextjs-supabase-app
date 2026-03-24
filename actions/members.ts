"use server";

/**
 * Server Actions for admin member management.
 *
 * These actions run on the server and are called from Client Components.
 * They handle Supabase mutations on the profiles table for member lifecycle:
 *   - approveMember: pending → member
 *   - rejectMember:  delete profile row for pending members (does NOT delete auth user)
 *   - promoteToAdmin: member → admin
 *   - deleteMember:  permanently delete any member's profile row (no role restriction)
 *
 * IMPORTANT: rejectMember only deletes the profiles row, not the auth.users row.
 * Deleting auth users requires the Supabase Admin API (service_role key),
 * which must not be exposed in Server Actions. Handle auth user cleanup separately.
 *
 * NOTE: RLS policies on the DB layer enforce authorization (admin only).
 * App layer also verifies role via getClaims() + profiles lookup for early return,
 * avoiding unnecessary DB writes from non-admins.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types/profile";

/**
 * Retrieves the current user's ID from the JWT cookie without a network call.
 * Returns null if the session is missing or expired.
 *
 * Using getClaims() instead of getUser() avoids Supabase Auth API rate limits
 * (429 errors). RLS policies enforce authorization at the DB level.
 */
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/**
 * Retrieves the current user's role from the profiles table.
 * Returns null if the user has no profile or the query fails.
 *
 * @param userId - UUID of the current user
 */
async function getCurrentUserRole(userId: string): Promise<ProfileRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data.role as ProfileRole;
}

/**
 * Approves a pending member by changing their role from 'pending' to 'member'.
 *
 * Only admins can call this action. The .eq('role', 'pending') guard ensures
 * we never accidentally approve an already-approved member.
 *
 * @param profileId - UUID of the profile to approve
 */
export async function approveMember(
  profileId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(userId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Update the target profile's role to 'member'
  // The .eq('role', 'pending') guard prevents accidentally approving non-pending users
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: "member" })
    .eq("id", profileId)
    .eq("role", "pending");

  if (error) return { error: error.message };

  // Step 4: Revalidate the admin members page so the list refreshes
  revalidatePath("/admin/members");
  return { success: true };
}

/**
 * Rejects a pending member by deleting their profile row from the database.
 *
 * NOTE: This does NOT delete the auth.users row. The user's Google account
 * record in Supabase Auth remains intact. Only the profiles row is removed,
 * which effectively revokes their access to the app.
 *
 * The .eq('role', 'pending') guard ensures we never accidentally delete
 * an approved member's profile.
 *
 * @param profileId - UUID of the profile to reject (delete)
 */
export async function rejectMember(
  profileId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(userId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Delete the profiles row
  // .eq('role', 'pending') is a safety guard — never delete approved members here
  // count:'exact' makes Supabase return the number of deleted rows.
  // If count === 0 the RLS policy blocked the delete (or the row no longer exists).
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("profiles")
    .delete({ count: "exact" })
    .eq("id", profileId)
    .eq("role", "pending");

  if (error) return { error: error.message };
  if (count === 0)
    return { error: "해당 회원을 찾을 수 없거나 이미 처리되었습니다" };

  // Step 4: Revalidate the admin members page so the list refreshes
  revalidatePath("/admin/members");
  return { success: true };
}

/**
 * Promotes an existing member to the 'admin' role.
 *
 * Only admins can call this action. No role guard on the target because
 * we want to allow promoting any non-admin member (including re-promoting
 * if needed). RLS at the DB layer enforces admin-only writes.
 *
 * @param profileId - UUID of the profile to promote to admin
 */
export async function promoteToAdmin(
  profileId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(userId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Update the target profile's role to 'admin'
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", profileId);

  if (error) return { error: error.message };

  // Step 4: Revalidate the admin members page so the list refreshes
  revalidatePath("/admin/members");
  return { success: true };
}

/**
 * Permanently deletes any member's profile row from the database.
 *
 * Unlike rejectMember (pending-only), this has no role guard and can remove
 * approved members and admins.
 *
 * IMPORTANT: This only deletes the profiles row, NOT the auth.users record.
 * The user's auth identity remains in Supabase Auth. Only their app profile
 * and access are removed.
 *
 * Self-deletion is blocked: an admin cannot delete their own profile.
 *
 * @param profileId - UUID of the profile to permanently delete
 */
export async function deleteMember(
  profileId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(userId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Block self-deletion — an admin deleting their own profile would
  // lock them out of the app and could leave no admins in the system
  if (profileId === userId)
    return { error: "자신의 계정은 삭제할 수 없습니다" };

  // Step 4: Delete the profiles row with count:'exact' so we know if RLS
  // silently blocked the operation
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("profiles")
    .delete({ count: "exact" })
    .eq("id", profileId);

  if (error) return { error: error.message };
  if (count === 0) return { error: "해당 회원을 찾을 수 없습니다" };

  // Step 5: Revalidate the admin members page so the card disappears
  revalidatePath("/admin/members");
  return { success: true };
}
