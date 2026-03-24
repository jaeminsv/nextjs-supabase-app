"use server";

/**
 * Server Actions for RSVP (attendance response) management.
 *
 * These actions run on the server and are called from Client Components.
 * They handle Supabase mutations for RSVP upserts and queries.
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
import type { RsvpFormData } from "@/lib/validations/rsvp";
import type { Rsvp } from "@/lib/types/rsvp";

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
 * Submits or updates (upserts) the current user's RSVP for an event.
 *
 * Flow:
 * 1. Authenticate the current user via getClaims().
 * 2. Fetch the event to check the RSVP deadline and capacity.
 * 3. Reject submission if the deadline has passed (deadline = rsvp_deadline ?? start_at).
 * 4. Reject submission if the event is at full capacity (only for 'going' RSVPs).
 * 5. Upsert the RSVP row (insert or update if the user already has one for this event).
 * 6. Revalidate cached pages that display RSVP data.
 *
 * @param eventId - UUID of the event to RSVP for
 * @param data    - Validated RSVP form data (status, adult_guests, child_guests)
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function submitRsvp(
  eventId: string,
  data: RsvpFormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated before any DB access
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Fetch the event to check deadline, capacity, and companion collection settings
  const { data: event, error: eventError } = await supabase
    .from("events")
    .select(
      "rsvp_deadline, start_at, max_capacity, collect_adult_guests, collect_child_guests_with_meal, collect_child_guests_no_meal",
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    console.error("submitRsvp: event fetch error:", eventError);
    return { error: "Event not found." };
  }

  // RSVP deadline check:
  // If rsvp_deadline is set, use it. Otherwise fall back to start_at.
  // Members cannot change their RSVP after the deadline.
  const deadline = event.rsvp_deadline ?? event.start_at;
  if (new Date() > new Date(deadline)) {
    return {
      error:
        "RSVP deadline has passed. You cannot submit or change your response.",
    };
  }

  // Capacity check (only needed if the event has a max_capacity set):
  // Count total attendees (1 person + their guests) across all 'going' RSVPs,
  // excluding the current user's existing RSVP to allow them to update their guest count.
  if (event.max_capacity !== null && data.status === "going") {
    const { data: goingRsvps, error: countError } = await supabase
      .from("rsvps")
      .select("adult_guests, child_guests, user_id")
      .eq("event_id", eventId)
      .eq("status", "going");

    if (countError) {
      console.error("submitRsvp: capacity check error:", countError);
      return { error: "Failed to check event capacity. Please try again." };
    }

    // Sum up attendees from all 'going' RSVPs, but skip the current user's existing entry
    // so they can modify their own guest count without triggering a false capacity error.
    const currentAttendees = (goingRsvps ?? [])
      .filter((r) => r.user_id !== userId)
      .reduce(
        // Each RSVP represents: 1 member + their adult guests + their child guests
        (sum, r) => sum + 1 + r.adult_guests + r.child_guests,
        0,
      );

    // Calculate how many spots the current user's submission would occupy.
    // Only count companion types that this event actually collects.
    const adultGuestsCount = event.collect_adult_guests ? data.adult_guests : 0;
    const childGuestsWithMealCount = event.collect_child_guests_with_meal
      ? (data.child_guests_with_meal ?? 0)
      : 0;
    const childGuestsNoMealCount = event.collect_child_guests_no_meal
      ? (data.child_guests_no_meal ?? 0)
      : 0;
    const requestedSpots =
      1 + adultGuestsCount + childGuestsWithMealCount + childGuestsNoMealCount;

    if (currentAttendees + requestedSpots > event.max_capacity) {
      return { error: "This event is at full capacity." };
    }
  }

  // Enforce companion collection settings server-side to prevent client-side tampering.
  // If an event does not collect a certain companion type, force that count to 0.
  const sanitizedAdultGuests = event.collect_adult_guests
    ? data.adult_guests
    : 0;
  const sanitizedChildGuestsWithMeal = event.collect_child_guests_with_meal
    ? (data.child_guests_with_meal ?? 0)
    : 0;
  const sanitizedChildGuestsNoMeal = event.collect_child_guests_no_meal
    ? (data.child_guests_no_meal ?? 0)
    : 0;

  // Upsert the RSVP row.
  // onConflict: 'event_id,user_id' means: if a row with the same event_id AND user_id
  // already exists, update it instead of inserting a duplicate.
  const { error: upsertError } = await supabase.from("rsvps").upsert(
    {
      event_id: eventId,
      user_id: userId,
      status: data.status,
      adult_guests: sanitizedAdultGuests,
      // Keep legacy child_guests in sync with the sum of both child types
      child_guests: sanitizedChildGuestsWithMeal + sanitizedChildGuestsNoMeal,
      child_guests_with_meal: sanitizedChildGuestsWithMeal,
      child_guests_no_meal: sanitizedChildGuestsNoMeal,
      // Store the member's optional message to organizers (null if not provided)
      message_to_organizer: data.message_to_organizer ?? null,
    },
    { onConflict: "event_id,user_id" },
  );

  if (upsertError) {
    console.error("submitRsvp: upsert error:", upsertError);
    return { error: upsertError.message };
  }

  // Revalidate pages that display RSVP data so they reflect the updated response
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Fetches all RSVPs for a given event.
 *
 * This is used by organizers/admins to view the attendee list.
 * RLS policies on the rsvps table restrict full access to organizers and admins only —
 * regular members can only read their own row.
 *
 * @param eventId - UUID of the event to fetch RSVPs for
 * @returns { data: Rsvp[] } on success, or { error: string } on failure
 */
export async function getRsvpsByEvent(
  eventId: string,
): Promise<{ data?: Rsvp[]; error?: string }> {
  const supabase = await createClient();

  // Ensure the caller is authenticated before querying
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { data, error } = await supabase
    .from("rsvps")
    .select("*")
    .eq("event_id", eventId);

  if (error) {
    console.error("getRsvpsByEvent error:", error);
    return { error: error.message };
  }

  return { data: (data as Rsvp[]) ?? [] };
}
