/**
 * Event types for alumni gatherings and meetups.
 * An Event is anything the community organizes (dinners, picnics, etc.).
 */

import type { Profile } from "@/lib/types/profile";

// Defines all possible lifecycle states for an event.
// "as const" ensures TypeScript treats these as literal types, not just strings.
export const EVENT_STATUSES = {
  // Event has been created but is not yet visible to regular members
  DRAFT: "draft",
  // Event is visible to members and accepting RSVPs
  PUBLISHED: "published",
  // Event has been cancelled and will not take place
  CANCELLED: "cancelled",
  // Event has already occurred
  COMPLETED: "completed",
} as const;

// Derives the union type from the EVENT_STATUSES object values.
// Result: "draft" | "published" | "cancelled" | "completed"
export type EventStatus = (typeof EVENT_STATUSES)[keyof typeof EVENT_STATUSES];

/**
 * Represents a community event with scheduling, location, and fee details.
 * Events are created by admins or organizers and RSVPed to by members.
 */
export interface Event {
  // Unique identifier for the event (UUID)
  id: string;

  // Short, descriptive title of the event (e.g. "Spring Picnic 2026")
  title: string;

  // Detailed description of the event; supports Markdown formatting for rich text
  // null if no description has been provided
  description: string | null;

  // ISO 8601 datetime string for when the event begins
  start_at: string;

  // ISO 8601 datetime string for when the event ends
  // null if the end time is not set or open-ended
  end_at: string | null;

  // ISO 8601 datetime string after which members can no longer submit RSVPs
  // null if there is no RSVP deadline
  rsvp_deadline: string | null;

  // Physical address or venue name where the event takes place
  location: string;

  // Base attendance fee per adult member, in US dollars
  // Zero means the event is free for members
  fee_amount: number;

  // Additional fee per adult guest (non-member) brought by a member, in US dollars
  adult_guest_fee: number;

  // Additional fee per child guest brought by a member, in US dollars
  child_guest_fee: number;

  // Instructions explaining how members should submit payment
  // For example: "Pay via Venmo @handle" or "Pay at the door"
  // null if no specific instructions are provided
  payment_instructions: string | null;

  // Maximum number of attendees allowed for this event
  // null means there is no capacity limit (unlimited)
  max_capacity: number | null;

  // Current lifecycle status of the event
  status: EventStatus;

  // User ID (UUID) of the person who created this event
  created_by: string;

  // ISO 8601 datetime string when this event record was first created
  created_at: string;

  // ISO 8601 datetime string when this event record was last modified
  updated_at: string;
}

/**
 * Represents a link between an event and one of its organizers.
 * A single event can have multiple organizers who help manage it.
 * Includes a partial Profile snapshot for display purposes.
 */
export interface EventOrganizer {
  // ID of the event this organizer is associated with
  event_id: string;

  // ID of the user who is an organizer for this event
  user_id: string;

  // Minimal profile information for the organizer, used in UI displays.
  // Only includes fields needed to identify and display the organizer.
  profile: Pick<Profile, "id" | "display_name" | "full_name">;
}
