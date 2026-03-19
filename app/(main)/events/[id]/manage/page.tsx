/**
 * Attendee & fee management page — organizer/admin dashboard for an event.
 * Wraps data-fetching in Suspense as required by cacheComponents mode.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { PageHeader } from "@/components/page-header";
import { ManageEventClient } from "@/components/manage-event-client";
import type { Rsvp } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";
import type { Profile } from "@/lib/types/profile";

// Pre-computed row combining RSVP, profile, payment, and fee info.
// Defined here and re-exported so ManageEventClient can share the same shape.
export interface AttendeeRow {
  profile: Profile;
  rsvp: Rsvp;
  payment?: Payment; // undefined = no payment submitted yet
  totalFee: number; // fee_amount + adult_guests*adult_guest_fee + child_guests*child_guest_fee
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Inner async component that resolves params and fetches all uncached data.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function ManageEventContent({ params }: PageProps) {
  // Await params inside the Suspense boundary to satisfy cacheComponents mode
  const { id } = await params;

  // Fetch the event and organizers — returns 404 if not found or RLS blocks access
  const { event, organizers } = await getEventById(id);
  if (!event) notFound();

  const supabase = await createClient();

  // Determine if the current user is an admin so we can show the organizer section.
  // getClaims() reads the JWT locally — no Auth API network call needed.
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;
  let isAdmin = false;
  if (userId) {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    isAdmin = profileData?.role === "admin";
  }

  // Fetch only 'going' RSVPs with joined profile data for display
  const { data: goingRsvps } = await supabase
    .from("rsvps")
    .select("*, profile:profiles(id, display_name, full_name, email, role)")
    .eq("event_id", id)
    .eq("status", "going");

  // Fetch all payment records for this event
  const { data: eventPayments } = await supabase
    .from("payments")
    .select("*")
    .eq("event_id", id);

  const rsvps = goingRsvps ?? [];
  const payments = eventPayments ?? [];

  // Build AttendeeRow array with pre-calculated fees per attendee
  const attendees: AttendeeRow[] = rsvps.flatMap((rsvpRow) => {
    // The joined profile data comes back nested under "profile"
    const profile = rsvpRow.profile as unknown as Profile;
    if (!profile) return [];

    // Build a plain Rsvp object without the nested profile field
    const rsvp: Rsvp = {
      id: rsvpRow.id,
      event_id: rsvpRow.event_id,
      user_id: rsvpRow.user_id,
      status: rsvpRow.status,
      adult_guests: rsvpRow.adult_guests,
      child_guests: rsvpRow.child_guests,
      created_at: rsvpRow.created_at,
      updated_at: rsvpRow.updated_at,
    };

    const payment = payments.find((p) => p.user_id === rsvpRow.user_id) as
      | Payment
      | undefined;

    // Total fee = base member fee + per-adult-guest + per-child-guest
    const totalFee =
      event.fee_amount +
      rsvpRow.adult_guests * event.adult_guest_fee +
      rsvpRow.child_guests * event.child_guest_fee;

    return [{ profile, rsvp, payment, totalFee }];
  });

  return (
    <div>
      <PageHeader title="참석자 & 회비 관리" backHref={`/events/${id}`} />
      <ManageEventClient
        event={event}
        attendees={attendees}
        isAdmin={isAdmin}
        organizers={organizers}
      />
    </div>
  );
}

/**
 * Manage event page shell.
 * Wraps the data-fetching content in Suspense.
 */
export default function ManageEventPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3 p-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        </div>
      }
    >
      <ManageEventContent params={params} />
    </Suspense>
  );
}
