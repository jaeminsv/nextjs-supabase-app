/**
 * Attendee & fee management page — organizer/admin dashboard for an event.
 *
 * Fetches RSVPs (going only) and payments for the event, builds AttendeeRow
 * array with pre-calculated fees, then passes to ManageEventClient.
 *
 * Phase 2 (Task 008): Uses dummy data. Phase 3 will replace with Supabase queries.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */
import { notFound } from "next/navigation";
import {
  DUMMY_EVENTS,
  DUMMY_RSVPS,
  DUMMY_PAYMENTS,
  ALL_PROFILES,
} from "@/lib/dummy-data";
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

export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const event = DUMMY_EVENTS.find((e) => e.id === id);
  if (!event) notFound();

  // Only 'going' RSVPs are included in the attendee list
  const goingRsvps = DUMMY_RSVPS.filter(
    (r) => r.event_id === id && r.status === "going",
  );
  const eventPayments = DUMMY_PAYMENTS.filter((p) => p.event_id === id);

  // Build AttendeeRow array; skip rows where profile lookup fails
  const attendees: AttendeeRow[] = goingRsvps.flatMap((rsvp) => {
    const profile = ALL_PROFILES.find((p) => p.id === rsvp.user_id);
    if (!profile) return [];
    const payment = eventPayments.find((p) => p.user_id === rsvp.user_id);
    const totalFee =
      event.fee_amount +
      rsvp.adult_guests * event.adult_guest_fee +
      rsvp.child_guests * event.child_guest_fee;
    return [{ profile, rsvp, payment, totalFee }];
  });

  return (
    <div>
      <PageHeader title="참석자 & 회비 관리" backHref={`/events/${id}`} />
      <ManageEventClient event={event} attendees={attendees} />
    </div>
  );
}
