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
  // Number of child guests the member is bringing (legacy field — kept for backward compatibility)
  // Must be 0 or a positive integer — cannot be negative
  child_guests: z
    .number()
    .int()
    .min(0, "아동 동반자 수는 0 이상이어야 합니다")
    .optional()
    .default(0),
  // Number of child guests who need a meal at the event
  child_guests_with_meal: z
    .number()
    .int()
    .min(0, "식사 필요 아동 수는 0 이상이어야 합니다")
    .default(0),
  // Number of child guests who do NOT need a meal at the event
  child_guests_no_meal: z
    .number()
    .int()
    .min(0, "식사 불필요 아동 수는 0 이상이어야 합니다")
    .default(0),
  // Optional private message to event organizers (max 500 chars)
  // Only visible to admins and event organizers, not to other members
  message_to_organizer: z
    .string()
    .max(500, "500자 이하로 입력해주세요")
    .optional(),
});
export type RsvpFormData = z.infer<typeof rsvpSchema>;
