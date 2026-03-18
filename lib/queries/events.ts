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

    const { data, error } = await supabase
      .from("events")
      .select("*")
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

    const { data, error } = await supabase
      .from("events")
      .select("*")
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
 * Used on the event detail page to pre-populate the RSVP form or show the
 * member's existing response.
 *
 * @param eventId - UUID of the event to check the RSVP for
 * @returns The Rsvp record if found, or null if the user hasn't RSVPed
 */
export async function getMyRsvpForEvent(eventId: string): Promise<Rsvp | null> {
  try {
    const supabase = await createClient();

    // Get the current user — returns null if not authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // maybeSingle() returns null instead of throwing when no row is found,
    // which is the expected case when a member hasn't RSVPed yet.
    const { data, error } = await supabase
      .from("rsvps")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", user.id)
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
