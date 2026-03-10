import { z } from "zod";

// Schema for submitting or updating an RSVP to an event
// Used in the RSVP form shown on event detail pages
export const rsvpSchema = z.object({
  // Whether the member is attending, maybe attending, or not attending
  // going: confirmed attendance, maybe: tentative, not_going: declined
  status: z.enum(["going", "maybe", "not_going"]),
  // Number of adult guests the member is bringing (not counting themselves)
  // Must be 0 or a positive integer — cannot be negative
  adult_guests: z.number().int().min(0, "동반자 수는 0 이상이어야 합니다"),
  // Number of child guests the member is bringing
  // Must be 0 or a positive integer — cannot be negative
  child_guests: z.number().int().min(0, "아동 동반자 수는 0 이상이어야 합니다"),
});
export type RsvpFormData = z.infer<typeof rsvpSchema>;
