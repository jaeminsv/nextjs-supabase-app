/**
 * RSVP types for tracking member attendance responses to events.
 * Each member submits one RSVP per event to indicate their attendance intention.
 */

// Defines all possible attendance responses a member can give.
// "as const" ensures TypeScript treats these as literal types, not just strings.
export const RSVP_STATUSES = {
  // Member confirms they will attend
  GOING: "going",
  // Member is unsure but might attend
  MAYBE: "maybe",
  // Member will not attend
  NOT_GOING: "not_going",
} as const;

// Derives the union type from the RSVP_STATUSES object values.
// Result: "going" | "maybe" | "not_going"
export type RsvpStatus = (typeof RSVP_STATUSES)[keyof typeof RSVP_STATUSES];

/**
 * Represents a member's RSVP (attendance response) for a specific event.
 * Also captures how many guests the member plans to bring.
 * One member can only have one RSVP per event.
 */
export interface Rsvp {
  // Unique identifier for this RSVP record (UUID)
  id: string;

  // ID of the event this RSVP belongs to
  event_id: string;

  // ID of the member submitting this RSVP
  user_id: string;

  // The member's attendance intention for the event
  status: RsvpStatus;

  // Number of additional adult guests the member plans to bring (not including themselves)
  // For example, if a member brings their spouse, this would be 1
  adult_guests: number;

  // Number of child guests the member plans to bring
  // Children may have a different (often lower) fee than adults
  child_guests: number;

  // Optional private message from the member to event organizers.
  // Only visible to the member themselves and admins/organizers.
  // Null when the member did not leave a message.
  message_to_organizer: string | null;

  // ISO 8601 datetime string when this RSVP was first submitted
  created_at: string;

  // ISO 8601 datetime string when this RSVP was last updated
  updated_at: string;
}
