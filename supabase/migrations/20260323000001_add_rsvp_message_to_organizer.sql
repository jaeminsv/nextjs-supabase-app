-- =============================================================================
-- Add message_to_organizer column to rsvps table
-- =============================================================================
-- Allows members to leave a private message for event organizers when RSVPing.
-- The column is nullable TEXT — no message is stored as NULL (not empty string).
--
-- Security: No additional RLS policy needed.
-- Existing policies already handle this column:
--   - users_manage_own_rsvps (FOR ALL): members can read/write their own RSVP rows
--   - organizers_select_event_rsvps (FOR SELECT): admins and event organizers can
--     read all RSVP rows for their events, including this new column.
-- =============================================================================

ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS message_to_organizer TEXT;
