"use server";

/**
 * Server Actions for event organizer management.
 *
 * These actions run on the server and are called from Client Components.
 * They handle mutations on the event_organizers join table and a search
 * helper for finding approved members by name.
 *
 * Only admins can add or remove organizers from an event.
 * searchMembers is a read operation but is placed here as a Server Action
 * so Client Components can call it without an API route.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/types/profile";

// Minimal profile shape returned by searchMembers.
// Only the fields needed for the organizer picker UI are included.
export interface MemberSearchResult {
  id: string;
  display_name: string;
  full_name: string;
}

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
 * Retrieves the current user's role from the profiles table.
 * Returns null if the user has no profile or the query fails.
 *
 * @param userId - UUID of the current user
 */
async function getCurrentUserRole(userId: string): Promise<ProfileRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) return null;
  return data.role as ProfileRole;
}

/**
 * Adds a member as an organizer of an event.
 *
 * Idempotent: if the user is already an organizer (Postgres unique constraint
 * violation, error code 23505), the function returns success rather than an error.
 * This prevents race conditions when the UI is clicked multiple times.
 *
 * @param eventId - UUID of the event
 * @param userId  - UUID of the member to add as organizer
 */
export async function addOrganizer(
  eventId: string,
  userId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const callerId = await getCurrentUserId();
  if (!callerId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(callerId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Insert the organizer record into the join table
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_organizers")
    .insert({ event_id: eventId, user_id: userId });

  if (error) {
    // Postgres error code 23505 = unique_violation (already an organizer)
    // Treat as success for idempotency — the desired state is already achieved
    if (error.code === "23505") return { success: true };
    return { error: error.message };
  }

  // Step 4: Revalidate the event edit page so the organizer list refreshes
  revalidatePath("/events/" + eventId + "/edit");
  return { success: true };
}

/**
 * Removes a member from the organizer list of an event.
 *
 * @param eventId - UUID of the event
 * @param userId  - UUID of the organizer to remove
 */
export async function removeOrganizer(
  eventId: string,
  userId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const callerId = await getCurrentUserId();
  if (!callerId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(callerId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Delete the organizer record from the join table
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_organizers")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);

  if (error) return { error: error.message };

  // Step 4: Revalidate the event edit page so the organizer list refreshes
  revalidatePath("/events/" + eventId + "/edit");
  return { success: true };
}

/**
 * Searches for approved members (role = 'member' or 'admin') by display name
 * or full name. Used to populate the organizer picker in the event form.
 *
 * Returns an empty array if the query string is blank or if an error occurs.
 * The search is case-insensitive (ilike) and limited to 10 results.
 *
 * @param query - Partial name string to search for
 */
export async function searchMembers(
  query: string,
): Promise<MemberSearchResult[]> {
  // Guard: skip the DB call entirely for empty queries
  if (!query.trim()) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, full_name")
    .in("role", ["member", "admin"])
    .or(`display_name.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(10);

  // Return empty array on error rather than throwing — the UI can show a fallback
  if (error) {
    console.error("searchMembers error:", error);
    return [];
  }

  return data ?? [];
}
