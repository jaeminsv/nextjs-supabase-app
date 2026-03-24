-- =============================================================================
-- Migration: Backfill profile stubs for auth users missing a profiles row
-- =============================================================================
--
-- Root cause of "rsvps_user_id_fkey" FK violation:
--   rsvps.user_id REFERENCES public.profiles(id)
--   Some auth.users rows have no matching profiles row (e.g. accounts created
--   before the handle_new_auth_user trigger was installed, or cases where the
--   trigger failed silently).
--
-- This migration creates minimal profile stubs for those orphaned users using
-- the same logic as the handle_new_auth_user trigger.
--
-- Safety: ON CONFLICT (id) DO NOTHING ensures existing profiles are untouched.
-- SECURITY DEFINER is required to read from the auth schema.
-- =============================================================================

-- Create a temporary helper function with elevated privileges to access auth.users
CREATE OR REPLACE FUNCTION backfill_missing_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  SELECT
    u.id,
    COALESCE(u.email, ''),
    -- Prefer full_name from OAuth metadata; fall back to the email prefix
    COALESCE(
      u.raw_user_meta_data->>'full_name',
      split_part(COALESCE(u.email, ''), '@', 1)
    )
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id
  )
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Execute the backfill immediately during migration
SELECT backfill_missing_profiles();

-- Remove the helper function — it is no longer needed after the one-time backfill
DROP FUNCTION backfill_missing_profiles();
