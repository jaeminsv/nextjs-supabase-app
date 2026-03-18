// Event list page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import { getUpcomingEvents, getPastEvents } from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";
import { EventsListClient } from "@/components/events-list-client";

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

  // Get the current user ID to pass into the client component.
  // It will be used in Task 013 to look up the user's RSVP status per event.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <EventsListClient
      upcomingEvents={upcomingEvents}
      pastEvents={pastEvents}
      currentUserId={user?.id ?? ""}
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
