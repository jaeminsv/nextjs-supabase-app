-- =============================================================================
-- Migration: Add RLS policy so confirmed payers can see the full attendee roster
-- =============================================================================
--
-- Problem: The existing `users_select_own_payments` policy only allows a member
-- to read their own payment row. When `getConfirmedAttendeeProfiles()` runs in a
-- Server Component with the member's RLS context, it can only fetch the member's
-- own row — so the roster always shows just one person (themselves), even when
-- other attendees have confirmed payments.
--
-- Fix: Add a PERMISSIVE SELECT policy that allows any authenticated user whose
-- payment for this event is `confirmed` to read ALL confirmed payment rows for
-- the same event. Permissive policies are OR'd together in Supabase, so this
-- policy coexists safely with `users_select_own_payments`.
-- =============================================================================

CREATE POLICY confirmed_payers_select_event_payments ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    -- Grant access when the requesting user has a confirmed payment
    -- for the same event_id as the row being read.
    EXISTS (
      SELECT 1
      FROM public.payments AS my_payment
      WHERE my_payment.event_id = payments.event_id
        AND my_payment.user_id  = auth.uid()
        AND my_payment.status   = 'confirmed'
    )
  );
