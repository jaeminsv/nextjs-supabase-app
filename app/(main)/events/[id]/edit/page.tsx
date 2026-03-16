/**
 * Edit event page — form to modify an existing event.
 *
 * Phase 2: pre-populates form with dummy data. Phase 3: will call updateEvent server action.
 * Next.js 16: params must be awaited as Promise.
 */
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EventForm } from "@/components/event-form";
import { DUMMY_EVENTS } from "@/lib/dummy-data";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = DUMMY_EVENTS.find((e) => e.id === id);
  if (!event) notFound();

  // Convert null fields from Event type to undefined for EventFormData compatibility.
  // Event DB type uses null for optional fields; EventFormData uses undefined (Zod optional).
  const formDefaults = {
    ...event,
    description: event.description ?? undefined,
    end_at: event.end_at ?? undefined,
    rsvp_deadline: event.rsvp_deadline ?? undefined,
    payment_instructions: event.payment_instructions ?? undefined,
    max_capacity: event.max_capacity ?? undefined,
  };

  return (
    <div className="pb-20">
      <PageHeader title="이벤트 수정" backHref={`/events/${id}`} />
      <div className="p-4">
        <EventForm mode="edit" defaultValues={formDefaults} eventId={id} />
      </div>
    </div>
  );
}
