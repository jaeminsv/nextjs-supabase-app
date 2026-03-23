import type { Rsvp } from "@/lib/types/rsvp";

// Sample RSVPs for event-1 (봄 소풍) and event-2 (5월 만찬)
// user IDs reference the profile IDs defined in profiles.ts
export const DUMMY_RSVPS: Rsvp[] = [
  // event-1 RSVPs
  {
    id: "rsvp-1-member1",
    event_id: "event-1",
    user_id: "profile-member-1",
    status: "going",
    adult_guests: 1, // bringing spouse
    child_guests: 2,
    message_to_organizer: null,
    created_at: "2026-03-10T10:00:00Z",
    updated_at: "2026-03-10T10:00:00Z",
  },
  {
    id: "rsvp-1-member2",
    event_id: "event-1",
    user_id: "profile-member-2",
    status: "going",
    adult_guests: 0,
    child_guests: 0,
    message_to_organizer: null,
    created_at: "2026-03-11T09:00:00Z",
    updated_at: "2026-03-11T09:00:00Z",
  },
  {
    id: "rsvp-1-member3",
    event_id: "event-1",
    user_id: "profile-member-3",
    status: "maybe",
    adult_guests: 0,
    child_guests: 0,
    message_to_organizer: null,
    created_at: "2026-03-12T14:00:00Z",
    updated_at: "2026-03-12T14:00:00Z",
  },
  {
    id: "rsvp-1-admin",
    event_id: "event-1",
    user_id: "profile-admin",
    status: "going",
    adult_guests: 0,
    child_guests: 0,
    message_to_organizer: null,
    created_at: "2026-03-01T12:00:00Z",
    updated_at: "2026-03-01T12:00:00Z",
  },
  // event-2 RSVPs
  {
    id: "rsvp-2-member1",
    event_id: "event-2",
    user_id: "profile-member-1",
    status: "going",
    adult_guests: 0,
    child_guests: 0,
    message_to_organizer: null,
    created_at: "2026-03-10T11:00:00Z",
    updated_at: "2026-03-10T11:00:00Z",
  },
  {
    id: "rsvp-2-member2",
    event_id: "event-2",
    user_id: "profile-member-2",
    status: "not_going",
    adult_guests: 0,
    child_guests: 0,
    message_to_organizer: null,
    created_at: "2026-03-10T15:00:00Z",
    updated_at: "2026-03-10T15:00:00Z",
  },
];

// Helper: get RSVP for a specific user and event
export function getDummyRsvp(
  eventId: string,
  userId: string,
): Rsvp | undefined {
  return DUMMY_RSVPS.find(
    (r) => r.event_id === eventId && r.user_id === userId,
  );
}
