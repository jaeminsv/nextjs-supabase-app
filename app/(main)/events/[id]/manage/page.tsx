/**
 * Attendee & fee management page — organizer/admin dashboard for an event.
 * Wraps data-fetching in Suspense as required by cacheComponents mode.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEventById } from "@/lib/queries/events";
import { PageHeader } from "@/components/page-header";

// Dynamic import splits ManageEventClient into its own JS chunk.
// The manage page is only accessed by organizers/admins, so deferring its
// JS download reduces the initial bundle for regular member page loads.
const ManageEventClient = dynamic(() =>
  import("@/components/manage-event-client").then((m) => m.ManageEventClient),
);
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

  // Fetch only 'going' RSVPs with joined profile data for display.
  // Includes KAIST graduation years and company/job_title for the attendee card UI.
  const { data: goingRsvps } = await supabase
    .from("rsvps")
    .select(
      "*, profile:profiles(id, display_name, full_name, email, role, kaist_bs_year, kaist_ms_year, kaist_phd_year, is_integrated_ms_phd, company, job_title)",
    )
    .eq("event_id", id)
    .eq("status", "going");

  // Fetch payment records with only the columns needed for the attendee management UI.
  // Includes rsvp_id for linking payments to RSVPs, and method/status for display.
  const { data: eventPayments } = await supabase
    .from("payments")
    .select(
      "id, event_id, user_id, rsvp_id, status, method, amount, created_at, updated_at",
    )
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
      child_guests_with_meal: rsvpRow.child_guests_with_meal ?? 0,
      child_guests_no_meal: rsvpRow.child_guests_no_meal ?? 0,
      // Include the optional message left by the member for organizers.
      // Cast to any because Supabase inferred types won't know about the new
      // column until the migration is applied and types are regenerated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      message_to_organizer: (rsvpRow as any).message_to_organizer ?? null,
      created_at: rsvpRow.created_at,
      updated_at: rsvpRow.updated_at,
    };

    const payment = payments.find((p) => p.user_id === rsvpRow.user_id) as
      | Payment
      | undefined;

    // Total fee = base member fee + conditional guest fees based on collect_* flags.
    // Each guest category is only charged if the event is configured to collect it.
    const totalFee =
      event.fee_amount +
      (event.collect_adult_guests
        ? rsvp.adult_guests * event.adult_guest_fee
        : 0) +
      (event.collect_child_guests_with_meal
        ? rsvp.child_guests_with_meal * event.child_guest_fee
        : 0) +
      (event.collect_child_guests_no_meal
        ? rsvp.child_guests_no_meal * event.child_guest_no_meal_fee
        : 0);

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
