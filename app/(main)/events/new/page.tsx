/**
 * Create event page — form to create a new event.
 * Submits via the createEvent Server Action in actions/events.ts.
 */
import { PageHeader } from "@/components/page-header";
import { EventForm } from "@/components/event-form";

export default function CreateEventPage() {
  return (
    <div className="pb-20">
      <PageHeader title="이벤트 만들기" backHref="/events" />
      <div className="p-4">
        <EventForm mode="create" />
      </div>
    </div>
  );
}
