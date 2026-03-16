/**
 * Create event page — form to create a new event.
 *
 * Phase 2: console.log only. Phase 3: will call createEvent server action.
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
