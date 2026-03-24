-- =============================================================================
-- Migration: Fix infinite RLS recursion on the payments table
-- =============================================================================
--
-- Problem: The `confirmed_payers_select_event_payments` policy (added in
-- 20260324000001) uses a sub-SELECT against `public.payments` *inside* the
-- USING clause of a SELECT policy on `public.payments`.  PostgreSQL evaluates
-- every row access through the policy stack, so reading a payment row triggers
-- the policy, which tries to read payment rows, which triggers the policy …
-- causing the error:
--   "infinite recursion detected in policy for relation 'payments'"
--
-- Fix: Extract the "does this user have a confirmed payment for this event?"
-- check into a SECURITY DEFINER helper function.  A SECURITY DEFINER function
-- runs as its *definer* (the superuser that owns it), so the payments table is
-- accessed without going through RLS — breaking the recursion.  The policy
-- then calls the helper instead of containing a raw sub-SELECT.
--
-- Security note: SECURITY DEFINER functions MUST specify SET search_path so
-- that a malicious caller cannot substitute a different schema.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Create the SECURITY DEFINER helper function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.has_confirmed_payment(
  p_event_id UUID,
  p_user_id  UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE          -- result is consistent within a single statement
SECURITY DEFINER
SET search_path = public   -- prevent search_path-injection attacks
AS $$
  -- Bypass RLS and check directly whether the given user has a confirmed
  -- payment row for the given event.  Returns TRUE if at least one row
  -- matches, FALSE otherwise.
  SELECT EXISTS (
    SELECT 1
    FROM public.payments
    WHERE event_id = p_event_id
      AND user_id  = p_user_id
      AND status   = 'confirmed'
  );
$$;

-- Allow every authenticated user to call this function (read-only check).
GRANT EXECUTE ON FUNCTION public.has_confirmed_payment(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Drop the old recursive policy
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS confirmed_payers_select_event_payments ON public.payments;

-- ---------------------------------------------------------------------------
-- 3. Re-create the policy using the non-recursive helper function
-- ---------------------------------------------------------------------------

CREATE POLICY confirmed_payers_select_event_payments ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    -- Call the SECURITY DEFINER helper so no RLS sub-recursion occurs.
    -- Grants access when the requesting user has a confirmed payment for
    -- the same event as the row being evaluated.
    public.has_confirmed_payment(event_id, auth.uid())
  );
