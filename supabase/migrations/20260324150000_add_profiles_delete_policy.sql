-- =============================================================================
-- Add DELETE RLS policy for profiles table
-- =============================================================================
-- Problem: The profiles table had no DELETE policy, causing RLS to silently
-- block all DELETE operations. This caused rejectMember and deleteMember
-- Server Actions to return count=0 even though the admin had proper role.
--
-- Solution: Allow admins to delete any profile row except their own.
-- Self-deletion is blocked here at the DB level (also blocked in the app layer).
--
-- Note: In practice, deletions are now handled via auth.admin.deleteUser()
-- which bypasses RLS using the service_role key. This policy is added for
-- defense-in-depth and to support any future direct profile deletions.
-- =============================================================================

-- Allow admins to delete any profile row except their own.
-- get_my_role() is a SECURITY DEFINER function that bypasses RLS on profiles
-- to avoid infinite recursion.
CREATE POLICY admins_delete_any_profile ON public.profiles
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin' AND id != auth.uid());
