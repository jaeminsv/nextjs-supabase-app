/**
 * Read-only query functions for event data.
 *
 * These functions are designed to be imported directly by Server Components.
 * They do NOT need a "use server" directive because they are not Server Actions —
 * they are plain async functions that run on the server as part of RSC rendering.
 *
 * Error handling: functions return null/[] on failure rather than throwing,
 * so the page can render gracefully even when a query fails.
 */

import { createClient } from "@/lib/supabase/server";
import type { Event, EventOrganizer } from "@/lib/types/event";
import type { Rsvp } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";

/**
 * Returns upcoming published events sorted by start date (soonest first).
 *
 * "Upcoming" means status='published' AND start_at is in the future.
 * Draft, cancelled, and completed events are excluded.
 *
 * @returns Array of Event objects, or empty array on error
 */
export async function getUpcomingEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient();

    // Select only the columns needed for list/card display.
    // Excludes large text fields (description, payment_instructions) and
    // per-guest fee columns that are only needed on the detail page.
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, status, start_at, end_at, rsvp_deadline, location, max_capacity, fee_amount, created_by, created_at, updated_at",
      )
      .eq("status", "published")
      .gt("start_at", new Date().toISOString())
      .order("start_at", { ascending: true });

    if (error) {
      console.error("getUpcomingEvents error:", error);
      return [];
    }

    return (data as Event[]) ?? [];
  } catch (err) {
    console.error("getUpcomingEvents unexpected error:", err);
    return [];
  }
}

/**
 * Returns past events (completed or cancelled) sorted by start date (most recent first).
 *
 * Used for archive/history views showing events that have already occurred or were called off.
 *
 * @returns Array of Event objects, or empty array on error
 */
export async function getPastEvents(): Promise<Event[]> {
  try {
    const supabase = await createClient();

    // Select only the columns needed for list/card display (same set as getUpcomingEvents).
    // Full event details (description, payment_instructions, guest fees) are loaded
    // individually via getEventById when the user visits the event detail page.
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, title, status, start_at, end_at, rsvp_deadline, location, max_capacity, fee_amount, created_by, created_at, updated_at",
      )
      .in("status", ["completed", "cancelled"])
      .order("start_at", { ascending: false });

    if (error) {
      console.error("getPastEvents error:", error);
      return [];
    }

    return (data as Event[]) ?? [];
  } catch (err) {
    console.error("getPastEvents unexpected error:", err);
    return [];
  }
}

/**
 * Fetches a single event by its ID along with its organizers.
 *
 * The organizers query joins event_organizers with profiles to include
 * the minimal profile snapshot (id, display_name, full_name) needed for display.
 *
 * @param id - UUID of the event to fetch
 * @returns Object with event (Event | null) and organizers (EventOrganizer[])
 */
export async function getEventById(id: string): Promise<{
  event: Event | null;
  organizers: EventOrganizer[];
}> {
  try {
    const supabase = await createClient();

    // Fetch the event row
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (eventError || !eventData) {
      console.error("getEventById event error:", eventError);
      return { event: null, organizers: [] };
    }

    // Fetch organizers with a joined profile snapshot for display purposes.
    // The alias "profile:profiles(...)" tells PostgREST to join the profiles table
    // and return the result under the key "profile".
    const { data: organizerData, error: organizerError } = await supabase
      .from("event_organizers")
      .select(
        "event_id, user_id, profile:profiles(id, display_name, full_name)",
      )
      .eq("event_id", id);

    if (organizerError) {
      console.error("getEventById organizers error:", organizerError);
      // Return the event without organizers rather than failing completely
      return { event: eventData as Event, organizers: [] };
    }

    return {
      event: eventData as Event,
      organizers: (organizerData as unknown as EventOrganizer[]) ?? [],
    };
  } catch (err) {
    console.error("getEventById unexpected error:", err);
    return { event: null, organizers: [] };
  }
}

/**
 * Fetches the currently authenticated user's RSVP for a given event.
 *
 * Uses getClaims() instead of getUser() to read the user ID directly from
 * the local JWT cookie — this avoids a network round-trip to the Supabase
 * Auth API and prevents rate-limit (429) errors during page renders.
 *
 * @param eventId - UUID of the event to check the RSVP for
 * @returns The Rsvp record if found, or null if the user hasn't RSVPed
 */
export async function getMyRsvpForEvent(eventId: string): Promise<Rsvp | null> {
  try {
    const supabase = await createClient();

    // getClaims() reads the user ID from the JWT stored in the session cookie.
    // This is a local operation — no Auth API call, no rate-limit risk.
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return null;
    }

    // maybeSingle() returns null instead of throwing when no row is found,
    // which is the expected case when a member hasn't RSVPed yet.
    const { data, error } = await supabase
      .from("rsvps")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("getMyRsvpForEvent error:", error);
      return null;
    }

    return (data as Rsvp) ?? null;
  } catch (err) {
    console.error("getMyRsvpForEvent unexpected error:", err);
    return null;
  }
}

/**
 * Fetches the current user's RSVPs for multiple events in a single query.
 *
 * This is more efficient than calling getMyRsvpForEvent() in a loop because
 * it issues one database query to retrieve all relevant RSVP rows at once.
 * Used on the dashboard to show RSVP status badges on EventCards.
 *
 * Uses getClaims() to read the user ID from the local JWT (no Auth API call).
 *
 * @param eventIds - Array of event UUIDs to check RSVPs for
 * @returns A map of { [eventId]: Rsvp } for events where the user has RSVPed.
 *          Returns an empty object if the user is not authenticated or on error.
 */
export async function getUserRsvpsForEvents(
  eventIds: string[],
): Promise<Record<string, Rsvp>> {
  // Return early if no event IDs are provided — avoids an unnecessary DB call
  if (eventIds.length === 0) return {};

  try {
    const supabase = await createClient();

    // Read user ID from the JWT cookie (local, no network call)
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return {};
    }

    // Fetch all RSVPs for the given events belonging to the current user
    const { data, error } = await supabase
      .from("rsvps")
      .select("*")
      .eq("user_id", userId)
      .in("event_id", eventIds);

    if (error) {
      console.error("getUserRsvpsForEvents error:", error);
      return {};
    }

    // Convert the array into a map keyed by event_id for O(1) lookups in the UI.
    // Example: { "uuid-event-1": { id: "...", status: "going", ... }, ... }
    return (data as Rsvp[]).reduce<Record<string, Rsvp>>((acc, rsvp) => {
      acc[rsvp.event_id] = rsvp;
      return acc;
    }, {});
  } catch (err) {
    console.error("getUserRsvpsForEvents unexpected error:", err);
    return {};
  }
}

/**
 * Fetches the currently authenticated user's active payment for a given event.
 *
 * "Active" means the payment has status 'pending' or 'confirmed'.
 * A rejected payment is not returned — the member can re-submit after rejection.
 *
 * This is a Server Component query function, NOT a Server Action.
 * It is used to pass initial payment state as a prop to the Client Component,
 * avoiding a client-side fetch on first render (server-side hydration pattern).
 *
 * Uses getClaims() to read the user ID from the local JWT (no Auth API call).
 *
 * @param eventId - UUID of the event to check payment for
 * @returns The Payment record if an active one exists, or null otherwise
 */
export async function getMyPaymentForEvent(
  eventId: string,
): Promise<Payment | null> {
  try {
    const supabase = await createClient();

    // Read user ID from the JWT cookie (local, no network call)
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    // If the user is not authenticated, they have no payment to show
    if (!userId) {
      return null;
    }

    // maybeSingle() returns null instead of throwing when no row matches,
    // which is the expected case for members who haven't submitted a payment yet.
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed"])
      .maybeSingle();

    if (error) {
      console.error("getMyPaymentForEvent error:", error);
      return null;
    }

    return (data as Payment) ?? null;
  } catch (err) {
    console.error("getMyPaymentForEvent unexpected error:", err);
    return null;
  }
}
