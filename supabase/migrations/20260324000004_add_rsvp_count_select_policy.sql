-- Allow authenticated members and admins to read all RSVPs for published events.
-- This enables aggregate RSVP count display on event cards without exposing
-- personal RSVP data beyond what is already visible in the UI.
CREATE POLICY members_select_event_rsvps ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() IN ('member', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = rsvps.event_id
        AND events.status = 'published'
    )
  );
