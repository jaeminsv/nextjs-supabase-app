"use server";

/**
 * Server Actions for payment (event fee) management.
 *
 * These actions run on the server and are called from Client Components.
 * They handle Supabase mutations and queries for payment records.
 *
 * IMPORTANT: Do NOT call redirect() inside these functions.
 * Return a result object and let the calling component handle navigation.
 *
 * NOTE: RLS policies on the DB layer enforce authorization.
 * App layer verifies authentication via getClaims() (local JWT parse, no network call)
 * to avoid Supabase Auth API rate limits that getUser() can trigger.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReportPaymentFormData } from "@/lib/validations/payment";
import type { Payment } from "@/lib/types/payment";

/**
 * Retrieves the current user's ID from the JWT cookie without a network call.
 * Returns null if the session is missing or expired.
 *
 * Using getClaims() instead of getUser() avoids Supabase Auth API rate limits
 * (429 errors). RLS policies enforce authorization at the DB level.
 */
async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

/**
 * Reports a payment for an event the current user has RSVPed to as 'going'.
 *
 * Flow:
 * 1. Authenticate the current user via getClaims().
 * 2. Check that the user has a 'going' RSVP for this event (required before paying).
 * 3. Check that no active payment (pending or confirmed) already exists.
 * 4. Fetch event fee fields to calculate the total amount.
 * 5. Insert the payment record with status 'pending'.
 * 6. Revalidate cached pages that display payment data.
 *
 * Amount formula:
 *   fee_amount + (adult_guests * adult_guest_fee) + (child_guests * child_guest_fee)
 *
 * @param eventId - UUID of the event to report payment for
 * @param data    - Validated payment form data (method, optional note)
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function reportPayment(
  eventId: string,
  data: ReportPaymentFormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated before any DB access
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // A member must have a 'going' RSVP before they can submit a payment.
  // This ensures only confirmed attendees are charged fees.
  const { data: rsvp, error: rsvpError } = await supabase
    .from("rsvps")
    .select("id, adult_guests, child_guests_with_meal, child_guests_no_meal")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .eq("status", "going")
    .maybeSingle();

  if (rsvpError) {
    console.error("reportPayment: rsvp fetch error:", rsvpError);
    return { error: "Failed to check RSVP status. Please try again." };
  }

  if (!rsvp) {
    return {
      error: "going RSVP가 필요합니다. 먼저 참석 의사를 확인해주세요.",
    };
  }

  // Prevent duplicate submissions: a member can only have one active payment
  // (pending or confirmed) per event at a time.
  // A rejected payment does NOT count as active, so the member can re-submit.
  const { data: existingPayment, error: existingError } = await supabase
    .from("payments")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  if (existingError) {
    console.error(
      "reportPayment: existing payment check error:",
      existingError,
    );
    return { error: "Failed to check existing payment. Please try again." };
  }

  if (existingPayment) {
    return { error: "이미 활성 납부 기록이 있습니다." };
  }

  // Fetch event fee fields needed to calculate the total amount.
  // The amount is computed server-side to prevent client-side tampering.
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "fee_amount, adult_guest_fee, child_guest_fee, child_guest_no_meal_fee, collect_adult_guests, collect_child_guests_with_meal, collect_child_guests_no_meal",
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    console.error("reportPayment: event fetch error:", eventError);
    return { error: "Event not found." };
  }

  // Calculate total fee based on which companion types this event collects.
  // Only add a companion fee if the event is configured to collect that companion type.
  //
  // Formula:
  //   base_fee
  //   + (collect_adult_guests ? adult_guests × adult_guest_fee : 0)
  //   + (collect_child_guests_with_meal ? child_guests_with_meal × child_guest_fee : 0)
  //   + (collect_child_guests_no_meal ? child_guests_no_meal × child_guest_no_meal_fee : 0)
  const amount =
    (event.fee_amount ?? 0) +
    (event.collect_adult_guests
      ? rsvp.adult_guests * (event.adult_guest_fee ?? 0)
      : 0) +
    (event.collect_child_guests_with_meal
      ? (rsvp.child_guests_with_meal ?? 0) * (event.child_guest_fee ?? 0)
      : 0) +
    (event.collect_child_guests_no_meal
      ? (rsvp.child_guests_no_meal ?? 0) * (event.child_guest_no_meal_fee ?? 0)
      : 0);

  // Insert the payment record with 'pending' status.
  // An organizer must confirm or reject it later.
  const { error: insertError } = await supabase.from("payments").insert({
    event_id: eventId,
    user_id: userId,
    rsvp_id: rsvp.id,
    amount,
    method: data.method,
    status: "pending",
    note: data.note ?? null,
  });

  if (insertError) {
    console.error("reportPayment: insert error:", insertError);
    return { error: insertError.message };
  }

  // Revalidate both the public event page and the organizer manage page
  // so the new payment appears without a full page reload.
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/manage`);

  return { success: true };
}

/**
 * Confirms a member's payment for an event.
 *
 * Sets the payment status to 'confirmed' and records who confirmed it and when.
 * Authorization is enforced by RLS — only organizers/admins can update payments.
 *
 * @param paymentId - UUID of the payment to confirm
 * @param eventId   - UUID of the associated event (used for cache revalidation)
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function confirmPayment(
  paymentId: string,
  eventId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated before any DB access
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Update the payment status to 'confirmed'.
  // RLS ensures only organizers/admins of this event can perform this action.
  const { error } = await supabase
    .from("payments")
    .update({
      status: "confirmed",
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) {
    console.error("confirmPayment: update error:", error);
    return { error: error.message };
  }

  // Revalidate the manage page so the updated status is reflected immediately
  revalidatePath(`/events/${eventId}/manage`);

  return { success: true };
}

/**
 * Rejects a member's payment for an event.
 *
 * Sets the payment status to 'rejected' and records who rejected it and when.
 * After rejection, the member can submit a new payment (re-submit).
 * Authorization is enforced by RLS — only organizers/admins can update payments.
 *
 * @param paymentId - UUID of the payment to reject
 * @param eventId   - UUID of the associated event (used for cache revalidation)
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function rejectPayment(
  paymentId: string,
  eventId: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated before any DB access
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Update the payment status to 'rejected'.
  // RLS ensures only organizers/admins of this event can perform this action.
  const { error } = await supabase
    .from("payments")
    .update({
      status: "rejected",
      confirmed_by: userId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) {
    console.error("rejectPayment: update error:", error);
    return { error: error.message };
  }

  // Revalidate the manage page so the updated status is reflected immediately
  revalidatePath(`/events/${eventId}/manage`);

  return { success: true };
}

/**
 * Fetches all payments for a given event.
 *
 * Used by organizers/admins to view and manage all payment submissions.
 * RLS policies restrict access — only organizers and admins can see all payments.
 *
 * @param eventId - UUID of the event to fetch payments for
 * @returns { data: Payment[] } on success, or { error: string } on failure
 */
export async function getPaymentsByEvent(
  eventId: string,
): Promise<{ data?: Payment[]; error?: string }> {
  const supabase = await createClient();

  // Ensure the caller is authenticated before querying
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("event_id", eventId);

  if (error) {
    console.error("getPaymentsByEvent error:", error);
    return { error: error.message };
  }

  return { data: (data as Payment[]) ?? [] };
}

/**
 * Fetches the current user's active (pending or confirmed) payment for an event.
 *
 * Returns null if the user has no active payment for this event.
 * A rejected payment is not considered active — the user can re-submit after rejection.
 *
 * @param eventId - UUID of the event to check payment for
 * @returns { data: Payment | null } on success, or { error: string } on failure
 */
export async function getMyPayment(
  eventId: string,
): Promise<{ data?: Payment | null; error?: string }> {
  const supabase = await createClient();

  // Ensure the caller is authenticated before querying
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .in("status", ["pending", "confirmed"])
    .maybeSingle();

  if (error) {
    console.error("getMyPayment error:", error);
    return { error: error.message };
  }

  return { data: data as Payment | null };
}
