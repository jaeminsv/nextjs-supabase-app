import { z } from "zod";

// Schema for submitting a payment report for an event the member RSVPed to.
// The payment amount is calculated server-side based on the RSVP (fee + guests),
// so it is not included in this form schema.
export const reportPaymentSchema = z.object({
  // The payment service or channel used to transfer the money.
  // Must be one of the supported payment methods defined in lib/types/payment.ts.
  method: z.enum(["venmo", "zelle", "paypal", "other"]),

  // Optional note from the payer (e.g. "Sent $25 via Venmo @handle").
  // Helps organizers match the payment to the correct member transfer.
  note: z.string().optional(),
});

// TypeScript type derived from the Zod schema.
// Used to type the form data in React Hook Form.
export type ReportPaymentFormData = z.infer<typeof reportPaymentSchema>;
