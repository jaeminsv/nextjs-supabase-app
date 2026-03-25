"use server";

/**
 * Server Actions for admin member management.
 *
 * These actions run on the server and are called from Client Components.
 * They handle member lifecycle operations:
 *   - approveMember:  pending → member (profiles UPDATE)
 *   - rejectMember:   permanently delete a pending member (auth.users DELETE via Admin API)
 *   - promoteToAdmin: member → admin (profiles UPDATE)
 *   - deleteMember:   permanently delete any member (auth.users DELETE via Admin API)
 *
 * Why auth.admin.deleteUser() instead of profiles DELETE directly?
 * - The profiles table has `REFERENCES auth.users(id) ON DELETE CASCADE`, so
 *   deleting the auth.users row automatically cascades to the profiles row.
 * - This ensures both the auth identity and the app profile are fully removed.
 * - The Admin API uses the service_role key (lib/supabase/admin.ts) which bypasses
 *   RLS, guaranteeing the delete always succeeds for a valid admin caller.
 *
 * NOTE: RLS policies on the DB layer enforce authorization (admin only).
 * App layer also verifies role via getClaims() + profiles lookup for early return,
 * avoiding unnecessary DB writes from non-admins.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
 * Rejects a pending member by permanently deleting their auth.users record.
 *
 * Deletion strategy:
 * 1. Verify the target profile exists AND has role='pending' (safety guard).
 * 2. Call auth.admin.deleteUser() via the service_role Admin client.
 * 3. The `profiles` row is automatically removed via ON DELETE CASCADE.
 *
 * This approach ensures the auth identity and app profile are both cleaned up.
 * The .role='pending' check prevents accidentally rejecting approved members.
 *
 * @param profileId - UUID of the profile (= auth.users id) to reject
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

  // Step 3: Confirm the target profile exists and is still 'pending'.
  // This prevents accidentally deleting an already-approved member via this action.
  const supabase = await createClient();
  const { data: targetProfile, error: fetchError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .eq("role", "pending")
    .single();

  if (fetchError || !targetProfile) {
    return { error: "해당 회원을 찾을 수 없거나 이미 처리되었습니다" };
  }

  // Step 4: Delete the auth.users record using the Admin API (service_role key).
  // The profiles row is automatically deleted via the ON DELETE CASCADE constraint.
  const adminClient = createAdminClient();
  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(profileId);

  if (deleteError) return { error: deleteError.message };

  // Step 5: Revalidate the admin members page so the card disappears
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
 * Permanently deletes any member's auth.users record and cascades to their profile.
 *
 * Deletion strategy:
 * 1. Block self-deletion (an admin cannot delete their own account).
 * 2. Call auth.admin.deleteUser() via the service_role Admin client.
 * 3. The `profiles` row is automatically removed via ON DELETE CASCADE.
 *
 * Unlike rejectMember (pending-only), this has no role guard and can remove
 * approved members and other admins.
 *
 * @param profileId - UUID of the profile (= auth.users id) to permanently delete
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

  // Step 4: Delete the auth.users record using the Admin API (service_role key).
  // The profiles row is automatically deleted via the ON DELETE CASCADE constraint.
  const adminClient = createAdminClient();
  const { error: deleteError } =
    await adminClient.auth.admin.deleteUser(profileId);

  if (deleteError) {
    // AuthApiError with status 404 means the user does not exist in auth.users
    return { error: deleteError.message };
  }

  // Step 5: Revalidate the admin members page so the card disappears
  revalidatePath("/admin/members");
  return { success: true };
}
