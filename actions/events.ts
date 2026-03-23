"use server";

/**
 * Server Actions for event management.
 *
 * These actions run on the server and can be called from Client Components.
 * They handle Supabase mutations for event CRUD operations.
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
import type { Database } from "@/lib/supabase/database.types";
import type { EventFormData } from "@/lib/validations/event";

// Type aliases for the DB Insert/Update row types
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventOrganizerInsert =
  Database["public"]["Tables"]["event_organizers"]["Insert"];

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
 * Creates a new event as a draft and registers the creator as an organizer.
 *
 * Flow:
 * 1. Authenticate the current user.
 * 2. Insert a new row into the events table (status='draft').
 * 3. Insert a corresponding row into event_organizers so the creator
 *    appears as the event organizer.
 * 4. Revalidate cached pages that display event data.
 *
 * @param data - Validated event form data from the creation wizard
 * @returns { success: true, eventId: string } on success, or { error: string } on failure
 */
export async function createEvent(
  data: EventFormData,
): Promise<{ success?: true; eventId?: string; error?: string }> {
  const supabase = await createClient();

  // Verify the user is authenticated before attempting any DB write
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Build the event payload using the DB Insert type for type safety.
  // Status is always 'draft' on creation — admin/organizer publishes later.
  const eventPayload: EventInsert = {
    title: data.title,
    description: data.description ?? null,
    start_at: data.start_at,
    end_at: data.end_at ?? null,
    rsvp_deadline: data.rsvp_deadline ?? null,
    location: data.location,
    fee_amount: data.fee_amount,
    adult_guest_fee: data.adult_guest_fee,
    child_guest_fee: data.child_guest_fee,
    payment_instructions: data.payment_instructions ?? null,
    max_capacity: data.max_capacity ?? null,
    status: "draft",
    created_by: userId,
  };

  // Insert the event into the events table
  const { data: createdEvent, error: insertError } = await supabase
    .from("events")
    .insert(eventPayload)
    .select("id")
    .single();

  if (insertError || !createdEvent) {
    console.error("createEvent insert error:", insertError);
    return { error: insertError?.message ?? "Failed to create event." };
  }

  // Register the creator as an organizer for the newly created event.
  // If this step fails, we still have a dangling event row — log the error
  // and surface it to the caller so they can retry or alert the user.
  const organizerPayload: EventOrganizerInsert = {
    event_id: createdEvent.id,
    user_id: userId,
  };

  const { error: organizerError } = await supabase
    .from("event_organizers")
    .insert(organizerPayload);

  if (organizerError) {
    console.error("createEvent organizer insert error:", organizerError);
    return {
      error: `Event created but organizer registration failed: ${organizerError.message}`,
    };
  }

  // Revalidate pages that list or summarise events so they show the new draft
  revalidatePath("/events");
  revalidatePath("/dashboard");

  return { success: true, eventId: createdEvent.id };
}

/**
 * Updates an existing event's details.
 *
 * Only the event's own fields are updated here — status transitions
 * (publish, cancel, complete) have their own dedicated actions.
 *
 * @param id   - UUID of the event to update
 * @param data - Validated event form data with updated values
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function updateEvent(
  id: string,
  data: EventFormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({
      title: data.title,
      description: data.description ?? null,
      start_at: data.start_at,
      end_at: data.end_at ?? null,
      rsvp_deadline: data.rsvp_deadline ?? null,
      location: data.location,
      fee_amount: data.fee_amount,
      adult_guest_fee: data.adult_guest_fee,
      child_guest_fee: data.child_guest_fee,
      payment_instructions: data.payment_instructions ?? null,
      max_capacity: data.max_capacity ?? null,
      status: data.status,
    })
    .eq("id", id);

  if (updateError) {
    console.error("updateEvent error:", updateError);
    return { error: updateError.message };
  }

  // Revalidate both the list page and the individual event detail page
  revalidatePath("/events");
  revalidatePath(`/events/${id}`);

  return { success: true };
}

/**
 * Transitions an event from 'draft' to 'published', making it visible to members.
 *
 * @param id - UUID of the event to publish
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function publishEvent(
  id: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "published" })
    .eq("id", id);

  if (updateError) {
    console.error("publishEvent error:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Cancels an event by changing its status to 'cancelled'.
 *
 * IMPORTANT: This does NOT hard-delete the event record.
 * Cancelled events remain in the database for historical reference and audit.
 *
 * @param id - UUID of the event to cancel
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function cancelEvent(
  id: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (updateError) {
    console.error("cancelEvent error:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Marks an event as 'completed' after it has taken place.
 *
 * @param id - UUID of the event to mark as completed
 * @returns { success: true } on success, or { error: string } on failure
 */
export async function completeEvent(
  id: string,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ status: "completed" })
    .eq("id", id);

  if (updateError) {
    console.error("completeEvent error:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/events");
  revalidatePath(`/events/${id}`);

  return { success: true };
}

/**
 * Permanently deletes an event and all associated data (RSVPs, organizers).
 *
 * Authorization: Only the event organizer or an admin may delete an event.
 * Both checks are performed server-side for defense in depth.
 *
 * IMPORTANT: This is a hard delete — the record cannot be recovered.
 * Related rows in rsvps and event_organizers are removed via DB FK cascade.
 *
 * Do NOT call redirect() here — return {} and let the caller handle
 * navigation (consistent with the pattern used in this file).
 *
 * @param eventId - UUID of the event to delete
 * @returns {} on success, or { error: string } on failure / unauthorized
 */
export async function deleteEvent(
  eventId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // Verify the caller is authenticated before any DB access
  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: "Not authenticated. Please sign in again." };
  }

  // Check if the caller has admin role in their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  const isAdmin = profile?.role === "admin";

  // Check if the caller is listed as an organizer for this specific event
  const { data: organizerRow } = await supabase
    .from("event_organizers")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .single();
  const isOrganizer = !!organizerRow;

  // Reject the request if the caller is neither admin nor organizer
  if (!isAdmin && !isOrganizer) {
    return { error: "이벤트를 삭제할 권한이 없습니다." };
  }

  // Hard-delete the event row — FK ON DELETE CASCADE removes related rows
  // (rsvps, event_organizers) automatically in the DB schema
  const { error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);

  if (deleteError) {
    console.error("deleteEvent error:", deleteError);
    return { error: "이벤트 삭제에 실패했습니다." };
  }

  // Revalidate events list so the deleted event no longer appears
  revalidatePath("/events");
  revalidatePath("/dashboard");

  return {};
}
