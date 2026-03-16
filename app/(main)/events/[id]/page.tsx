/**
 * Event detail page — Server Component wrapper.
 * Resolves route params, looks up event from dummy data,
 * and passes resolved data to the interactive Client Component.
 *
 * Phase 2 (Task 006): Implemented with dummy data.
 * Phase 3: Replace dummy data lookups with Supabase queries.
 */
import { notFound } from "next/navigation";
import {
  DUMMY_EVENTS,
  CURRENT_USER,
  getDummyRsvp,
  getDummyPayment,
} from "@/lib/dummy-data";
import { EventDetailClient } from "@/components/event-detail-client";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await params — required in Next.js 16 App Router
  const { id } = await params;

  // Find event from dummy data; return 404 if not found
  const event = DUMMY_EVENTS.find((e) => e.id === id);
  if (!event) notFound();

  // Look up current user's RSVP and payment for this event
  const initialRsvp = getDummyRsvp(id, CURRENT_USER.id);
  const initialPayment = getDummyPayment(id, CURRENT_USER.id);

  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp}
      initialPayment={initialPayment}
    />
  );
}
