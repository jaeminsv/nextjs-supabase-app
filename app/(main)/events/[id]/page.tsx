// Event detail page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getEventById, getMyRsvpForEvent } from "@/lib/queries/events";
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

  // Fetch the event and current user's RSVP in parallel
  const [{ event }, initialRsvp] = await Promise.all([
    getEventById(id),
    getMyRsvpForEvent(id),
  ]);

  // Return 404 if the event does not exist or RLS blocked access
  if (!event) notFound();

  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp ?? undefined}
      // initialPayment will be wired in Task 014
      initialPayment={undefined}
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
