import { z } from "zod";

// Schema for creating or editing an event
// Used in the event creation/edit form with React Hook Form
export const eventSchema = z.object({
  // Event title shown in listings and detail pages (2–100 characters)
  title: z
    .string()
    .min(2, "제목은 2자 이상이어야 합니다")
    .max(100, "제목은 100자 이하여야 합니다"),
  // Optional detailed description of the event (supports rich text or plain text)
  description: z.string().optional(),
  // ISO 8601 datetime string for when the event starts (e.g. "2026-04-01T18:00:00Z")
  start_at: z
    .string()
    .datetime({ message: "올바른 날짜/시간 형식이어야 합니다" }),
  // ISO 8601 datetime string for when the event ends — optional for open-ended events
  end_at: z.string().datetime().optional(),
  // Deadline by which members must submit their RSVP — optional
  rsvp_deadline: z.string().datetime().optional(),
  // Physical or virtual location of the event (minimum 2 characters)
  location: z.string().min(2, "장소를 입력해주세요"),
  // Base attendance fee per member in USD (0 means free)
  fee_amount: z.number().min(0, "회비는 0 이상이어야 합니다"),
  // Additional fee charged per adult guest a member brings
  adult_guest_fee: z.number().min(0, "동반자 회비는 0 이상이어야 합니다"),
  // Additional fee charged per child guest a member brings
  child_guest_fee: z.number().min(0),
  // Instructions for how to pay the fee (e.g. "Venmo @kaist-sv")
  payment_instructions: z.string().optional(),
  // Maximum number of attendees allowed — null means unlimited capacity
  max_capacity: z.number().int().positive().optional(),
  // Current lifecycle status of the event
  // draft: being prepared, published: visible to members, cancelled/completed: done
  status: z.enum(["draft", "published", "cancelled", "completed"]),
});
export type EventFormData = z.infer<typeof eventSchema>;
