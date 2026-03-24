// Event list page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import dynamic from "next/dynamic";
import {
  getUpcomingEvents,
  getPastEvents,
  getUserRsvpsForEvents,
} from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";
import type { Rsvp } from "@/lib/types/rsvp";

// Dynamic import splits EventsListClient into its own JS chunk.
// This reduces the initial bundle size because the component code is only
// downloaded after the server renders the page shell and sends it to the browser.
const EventsListClient = dynamic(() =>
  import("@/components/events-list-client").then((m) => m.EventsListClient),
);

/**
 * Inner async component that fetches all uncached data.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function EventsContent() {
  // Fetch upcoming and past events in parallel to minimise server latency
  const [upcomingEvents, pastEvents] = await Promise.all([
    getUpcomingEvents(),
    getPastEvents(),
  ]);

  // Read the current user's ID from the JWT cookie without a network call.
  // getClaims() is preferred over getUser() to avoid Auth API rate limits (429 errors).
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const currentUserId = claimsData?.claims?.sub ?? "";

  // Collect all event IDs from both tabs so we can fetch RSVP statuses in one query.
  // This avoids N+1 queries and allows EventCard to show the correct RSVP badge.
  const allEventIds = [
    ...upcomingEvents.map((e) => e.id),
    ...pastEvents.map((e) => e.id),
  ];
  const rsvpMap: Record<string, Rsvp> =
    currentUserId && allEventIds.length > 0
      ? await getUserRsvpsForEvents(allEventIds)
      : {};

  return (
    <EventsListClient
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      currentUserId={currentUserId}
      rsvpMap={rsvpMap}
    />
  );
}

/**
 * Event list page shell.
 * Wraps the data-fetching content in Suspense as required by cacheComponents mode.
 */
export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <EventsContent />
    </Suspense>
  );
}
