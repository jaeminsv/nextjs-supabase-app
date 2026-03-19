// Edit event page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EventForm } from "@/components/event-form";
import { getEventById } from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";
import type { EventFormData } from "@/lib/validations/event";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Inner async component that resolves params and fetches the event.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function EditEventContent({ params }: PageProps) {
  // Await params inside the Suspense boundary to satisfy cacheComponents mode
  const { id } = await params;

  // Fetch the event and its organizers from Supabase in parallel with role check.
  // getClaims() reads the JWT locally — no Auth API network call needed.
  const supabase = await createClient();
  const [{ event, organizers }, claimsResult] = await Promise.all([
    getEventById(id),
    supabase.auth.getClaims(),
  ]);

  if (!event) notFound();

  // Determine if the current user is an admin so we can show the organizer management UI.
  // We need the profile role from the DB because the JWT may not include custom claims.
  const userId = claimsResult.data?.claims?.sub ?? null;
  let isAdmin = false;
  if (userId) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    isAdmin = profileData?.role === "admin";
  }

  // Convert null fields from the DB Event type to undefined for EventFormData compatibility.
  // The DB schema uses null for optional fields; Zod's .optional() expects undefined, not null.
  const formDefaults: Partial<EventFormData> = {
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
        <EventForm
          mode="edit"
          defaultValues={formDefaults}
          eventId={id}
          initialOrganizers={organizers}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}

/**
 * Edit event page shell.
 * Wraps the data-fetching content in Suspense.
 */
export default function EditEventPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="h-96 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <EditEventContent params={params} />
    </Suspense>
  );
}
