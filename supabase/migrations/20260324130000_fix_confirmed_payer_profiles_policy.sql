-- =============================================================================
-- Migration: Simplify confirmed_payers_select_event_profiles policy
-- =============================================================================
--
-- Problem: The previous policy (added in 20260324120000) used a self-JOIN on
-- the payments table inside its USING clause:
--
--   EXISTS (
--     SELECT 1 FROM payments p1 JOIN payments p2 ON p1.event_id = p2.event_id
--     WHERE p1.user_id = auth.uid() AND p1.status = 'confirmed'
--       AND p2.user_id = profiles.id AND p2.status = 'confirmed'
--   )
--
-- Although the infinite recursion on payments was already resolved by the
-- has_confirmed_payment() SECURITY DEFINER helper (migration 20260324000003),
-- the nested JOIN between two aliases of the same payments table can still
-- produce unexpected NULL results when the RLS evaluation context switches
-- between the two alias scopes.  In practice this caused the profiles join
-- inside getConfirmedAttendeeProfiles() to return null for every row, making
-- the attendee roster appear empty even when confirmed payments existed.
--
-- Fix: Replace the self-JOIN with a simpler correlated sub-SELECT that checks
-- only the target profile's payment rows and delegates the "does the current
-- user have a confirmed payment for this event?" check to the already-proven
-- has_confirmed_payment() SECURITY DEFINER function.
--
-- New policy logic:
--   For a given profile row, allow SELECT when ALL of the following hold:
--     1. The profile belongs to a user who has at least one confirmed payment
--        for any event (p_target.user_id = profiles.id AND status='confirmed').
--     2. The requesting user also has a confirmed payment for that same event
--        (has_confirmed_payment(p_target.event_id, auth.uid()) = TRUE).
--
-- Because has_confirmed_payment() is SECURITY DEFINER, it reads the payments
-- table directly without going through RLS, so no recursion occurs.
--
-- This policy is PERMISSIVE and is OR'd with the two existing policies:
--   - users_select_own_profile    (id = auth.uid())
--   - members_select_all_profiles (get_my_role() IN ('member','admin'))
--
-- The new policy extends access to users whose role is still 'pending' but
-- who have a confirmed payment — they can now see co-attendee profiles for
-- the same event without needing the 'member' role.
-- =============================================================================

-- Drop the previous version to make this migration idempotent
DROP POLICY IF EXISTS confirmed_payers_select_event_profiles ON public.profiles;

-- Re-create with the simplified, non-recursive logic
CREATE POLICY confirmed_payers_select_event_profiles ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow when:
    --   (a) the target profile has a confirmed payment for some event, AND
    --   (b) the requesting user also has a confirmed payment for that same event.
    -- has_confirmed_payment() is SECURITY DEFINER — it bypasses payments RLS
    -- so there is no risk of recursive policy evaluation.
    EXISTS (
      SELECT 1
      FROM public.payments p_target
      WHERE p_target.user_id = profiles.id
        AND p_target.status  = 'confirmed'
        AND public.has_confirmed_payment(p_target.event_id, auth.uid())
    )
  );
