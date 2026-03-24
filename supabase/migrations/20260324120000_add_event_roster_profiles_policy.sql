-- =============================================================================
-- Migration: Add RLS policy so confirmed payers can read co-attendee profiles
-- =============================================================================
--
-- Problem: `getConfirmedAttendeeProfiles()` runs a nested join query of the form
--   payments → profiles
-- inside a Server Component under the requesting user's RLS context. The two
-- existing SELECT policies on `profiles` only permit:
--   • `users_select_own_profile`    — id = auth.uid()
--   • `members_select_all_profiles` — get_my_role() IN ('member', 'admin')
--
-- A user whose role is still `pending` (e.g. a first-time attendee who has not
-- yet been fully approved) satisfies neither policy. Consequently every profile
-- row belonging to another attendee is filtered out, causing the roster to come
-- back as an empty array even when multiple confirmed payments exist.
--
-- Fix: Add a PERMISSIVE SELECT policy that allows any authenticated user who has
-- a `confirmed` payment for a given event to read the profile of every OTHER
-- user who also has a `confirmed` payment for that same event. Because Supabase
-- evaluates PERMISSIVE policies with OR semantics, this policy coexists safely
-- with the two existing policies — it simply opens an additional access path
-- without narrowing anything that already works.
-- =============================================================================

-- Drop first to make this migration idempotent (safe to re-run if already applied manually)
DROP POLICY IF EXISTS confirmed_payers_select_event_profiles ON public.profiles;

CREATE POLICY confirmed_payers_select_event_profiles ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Grant access when ALL of the following hold:
    --   1. The requesting user (p1) has a confirmed payment for some event.
    --   2. The profile row being evaluated belongs to a user (p2) who also has
    --      a confirmed payment for that same event.
    -- This lets confirmed attendees see each other's profiles on the roster
    -- without exposing profiles to users who are not attending the same event.
    EXISTS (
      SELECT 1
      FROM public.payments AS p1
      JOIN public.payments AS p2 ON p1.event_id = p2.event_id
      WHERE p1.user_id = auth.uid()
        AND p1.status  = 'confirmed'
        AND p2.user_id = profiles.id
        AND p2.status  = 'confirmed'
    )
  );
