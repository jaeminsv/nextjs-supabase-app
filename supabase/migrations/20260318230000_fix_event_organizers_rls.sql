-- =============================================================================
-- Migration: Fix infinite recursion in event_organizers RLS policy
--
-- Problem:
--   The 'organizers_select_event_organizers' policy contained a self-referential
--   subquery (EXISTS SELECT ... FROM event_organizers). When Postgres evaluates
--   this policy, it triggers the same policy again → infinite recursion (42P17).
--
-- Fix:
--   1. Create a SECURITY DEFINER function 'is_event_organizer(event_id UUID)'
--      that checks the event_organizers table while BYPASSING RLS.
--      (SECURITY DEFINER runs with the privileges of the function owner,
--       not the calling user — so RLS is not applied inside the function.)
--   2. Drop the old recursive policy.
--   3. Recreate the policy using the safe helper function.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Step 1: Create a SECURITY DEFINER helper function
--
-- This function checks whether the currently logged-in user (auth.uid()) is
-- an organizer for the given event_id. Because it runs as the function owner
-- (who has superuser-like access to the table), it bypasses RLS and avoids
-- the infinite recursion problem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE        -- result is consistent within a single transaction
SECURITY DEFINER  -- run as function owner, bypasses RLS
SET search_path = public  -- prevent search_path injection attacks
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_organizers
    WHERE event_id = p_event_id
      AND user_id = auth.uid()
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_event_organizer(UUID) TO authenticated;


-- ---------------------------------------------------------------------------
-- Step 2: Drop the old recursive policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS organizers_select_event_organizers ON public.event_organizers;


-- ---------------------------------------------------------------------------
-- Step 3: Recreate the policy using the safe helper function
--
-- Policy logic:
--   - Admins can see all organizer records
--   - A user can see their own organizer record (user_id = auth.uid())
--   - A user can see other organizers of the same event if they are also
--     an organizer for that event (via is_event_organizer() — no recursion!)
-- ---------------------------------------------------------------------------
CREATE POLICY organizers_select_event_organizers ON public.event_organizers
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR user_id = auth.uid()
    OR is_event_organizer(event_id)  -- safe: uses SECURITY DEFINER function
  );
