// Event detail page — Server Component wrapper.
// Wraps data-fetching in Suspense as required by cacheComponents mode.

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import {
  getEventById,
  getMyRsvpForEvent,
  getMyPaymentForEvent,
  getConfirmedAttendeeProfiles,
} from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";

import type { AttendeeProfile, RosterAccess } from "@/lib/types/attendee";

// Dynamic import splits EventDetailClient into its own JS chunk.
// The detail page contains rich interactive UI (RSVP, payment forms) that
// is large enough to benefit from code splitting.
const EventDetailClient = dynamic(() =>
  import("@/components/event-detail-client").then((m) => m.EventDetailClient),
);

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

  // Fetch the event, RSVP, payment, and user auth info in parallel to minimize latency
  const [{ event, organizers }, initialRsvp, initialPayment, supabase] =
    await Promise.all([
      getEventById(id),
      getMyRsvpForEvent(id),
      getMyPaymentForEvent(id),
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

  // Determine roster access level for the current viewer.
  // "visible" — full attendee list shown
  // "pending" — section shown with "awaiting payment confirmation" message
  // "hidden"  — section not rendered at all
  //
  // Free events (fee_amount === 0): any going RSVP can see the list.
  // Paid events: only confirmed payers (and admins/organizers) can see the list.
  //
  // Note: hasPendingPayment relies on getMyPaymentForEvent excluding "rejected"
  // records. That function filters to ["pending", "confirmed"] only.
  // If that contract changes, this logic must be updated accordingly.
  const isFreeEvent = event.fee_amount === 0;
  const hasConfirmedPayment = initialPayment?.status === "confirmed";
  const hasPendingPayment = initialPayment?.status === "pending";
  const isGoing = initialRsvp?.status === "going";

  let rosterAccess: RosterAccess = "hidden";
  if (isAdmin || isOrganizer) {
    rosterAccess = "visible";
  } else if (isFreeEvent && isGoing) {
    rosterAccess = "visible";
  } else if (hasConfirmedPayment) {
    rosterAccess = "visible";
  } else if (hasPendingPayment) {
    rosterAccess = "pending";
  }

  // Only fetch attendee profiles when the viewer has full access.
  // This avoids an unnecessary DB round-trip for restricted viewers.
  let attendeeProfiles: AttendeeProfile[] = [];
  if (rosterAccess === "visible") {
    if (isFreeEvent) {
      // Free events: show all going RSVPs
      const { data: goingRsvps } = await supabase
        .from("rsvps")
        .select(
          "profile:profiles(id, display_name, kaist_bs_year, kaist_ms_year, kaist_phd_year, company, job_title)",
        )
        .eq("event_id", id)
        .eq("status", "going");

      attendeeProfiles = (goingRsvps ?? []).flatMap((r) =>
        r.profile ? [r.profile as unknown as AttendeeProfile] : [],
      );
    } else {
      // Paid events: show only attendees with confirmed payment
      attendeeProfiles = await getConfirmedAttendeeProfiles(id);
    }
  }

  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp ?? undefined}
      initialPayment={initialPayment ?? undefined}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
      attendeeProfiles={attendeeProfiles}
      rosterAccess={rosterAccess}
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
