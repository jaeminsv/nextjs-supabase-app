// Event detail page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventById, getMyRsvpForEvent } from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";
import { EventDetailClient } from "@/components/event-detail-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Inner async component that resolves params, fetches the event and RSVP data.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function EventDetailContent({ params }: PageProps) {
  // Await params inside the Suspense boundary to satisfy cacheComponents mode
  const { id } = await params;

  // Fetch the event, RSVP, and user auth info in parallel to minimize latency
  const [{ event, organizers }, initialRsvp, supabase] = await Promise.all([
    getEventById(id),
    getMyRsvpForEvent(id),
    createClient(),
  ]);

  // Return 404 if the event does not exist or RLS blocked access
  if (!event) notFound();

  // Read the current user's ID from the JWT cookie without a network call.
  // getClaims() is preferred over getUser() to avoid Auth API rate limits (429 errors).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  // Determine admin status by querying the user's role from the profiles table.
  // We only run this query if we have a valid userId to avoid unnecessary DB calls.
  let isAdmin = false;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    isAdmin = profile?.role === "admin";
  }

  // Check if the current user is listed as an organizer for this specific event.
  // Organizers have the same management permissions as admins for their own events.
  const isOrganizer = userId
    ? organizers.some((o) => o.user_id === userId)
    : false;

  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp ?? undefined}
      // initialPayment will be wired in Task 014
      initialPayment={undefined}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
    />
  );
}

/**
 * Event detail page shell.
 * Wraps the data-fetching content in Suspense.
 */
export default function EventDetailPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-4">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <EventDetailContent params={params} />
    </Suspense>
  );
}
