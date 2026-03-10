/**
 * Payment types for tracking event fee submissions and confirmations.
 * Members submit payments for events they RSVP to, and organizers confirm them.
 */

// Defines the current verification state of a payment submission.
// "as const" ensures TypeScript treats these as literal types, not just strings.
export const PAYMENT_STATUSES = {
  // Payment has been submitted by the member but not yet reviewed by an organizer
  PENDING: "pending",
  // An organizer has verified and approved the payment
  CONFIRMED: "confirmed",
  // An organizer has reviewed and denied the payment (e.g. wrong amount or handle)
  REJECTED: "rejected",
} as const;

// Derives the union type from the PAYMENT_STATUSES object values.
// Result: "pending" | "confirmed" | "rejected"
export type PaymentStatus =
  (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

// Defines all supported payment transfer services.
// "as const" ensures TypeScript treats these as literal types, not just strings.
export const PAYMENT_METHODS = {
  // Payment sent via Venmo
  VENMO: "venmo",
  // Payment sent via Zelle
  ZELLE: "zelle",
  // Payment sent via PayPal
  PAYPAL: "paypal",
  // Any other payment method (cash, check, etc.)
  OTHER: "other",
} as const;

// Derives the union type from the PAYMENT_METHODS object values.
// Result: "venmo" | "zelle" | "paypal" | "other"
export type PaymentMethod =
  (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/**
 * Represents a payment submission made by a member for a specific event RSVP.
 * The payment must be confirmed by an organizer before it is considered complete.
 */
export interface Payment {
  // Unique identifier for this payment record (UUID)
  id: string;

  // ID of the event this payment is associated with
  event_id: string;

  // ID of the member who submitted this payment
  user_id: string;

  // ID of the RSVP that this payment covers
  // Links the payment to the member's attendance record for fee calculation
  rsvp_id: string;

  // Total dollar amount (in USD) that the member claims to have sent
  // This is self-reported and must be verified by an organizer
  amount: number;

  // The payment service or channel used to transfer the money
  method: PaymentMethod;

  // Current review state of this payment submission
  status: PaymentStatus;

  // Optional message from the payer (e.g. "Sent $25 via Venmo for Spring Picnic")
  // null if the member did not include a note
  note: string | null;

  // User ID of the organizer who confirmed or rejected this payment
  // null if the payment has not yet been reviewed
  confirmed_by: string | null;

  // ISO 8601 datetime string for when the payment was confirmed or rejected
  // null if the payment has not yet been reviewed
  confirmed_at: string | null;

  // ISO 8601 datetime string when this payment record was first created
  created_at: string;

  // ISO 8601 datetime string when this payment record was last modified
  updated_at: string;
}
