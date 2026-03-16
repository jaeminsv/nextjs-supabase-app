// Dashboard page — Server Component (no 'use client' needed)
// Shows a greeting, unpaid event alert, and list of upcoming events.

import Link from "next/link";
import { AlertCircle, CalendarX } from "lucide-react";
import {
  DUMMY_EVENTS,
  DUMMY_RSVPS,
  CURRENT_USER,
  getDummyRsvp,
  getDummyPayment,
} from "@/lib/dummy-data";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";

export default function DashboardPage() {
  // Use a fixed reference date matching the current date in the project (2026-03-16).
  // In production this would be replaced with `new Date()` at runtime.
  const now = new Date("2026-03-16T00:00:00Z");

  // Filter to only published events that start in the future,
  // sort by start date ascending, and take the nearest 5.
  const upcomingEvents = DUMMY_EVENTS.filter(
    (e) => e.status === "published" && new Date(e.start_at) > now,
  )
    .sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    )
    .slice(0, 5);

  // Count how many attendees (going RSVPs) an event has.
  const getRsvpCount = (eventId: string) =>
    DUMMY_RSVPS.filter((r) => r.event_id === eventId && r.status === "going")
      .length;

  // Count upcoming events where the current user is going but has not confirmed payment.
  // "Unpaid" means: no payment record, OR payment is pending/rejected.
  const unpaidCount = upcomingEvents.filter((event) => {
    const rsvp = getDummyRsvp(event.id, CURRENT_USER.id);
    // Skip events where user is not attending
    if (rsvp?.status !== "going") return false;
    const payment = getDummyPayment(event.id, CURRENT_USER.id);
    return (
      !payment || payment.status === "pending" || payment.status === "rejected"
    );
  }).length;

  return (
    <div className="space-y-4 p-4">
      {/* Greeting header — shows the current user's display name */}
      <h1 className="text-2xl font-bold">
        안녕하세요, {CURRENT_USER.display_name}님!
      </h1>

      {/* Unpaid alert banner — only rendered when there is at least one unpaid event */}
      {unpaidCount > 0 && (
        <div className="flex items-center gap-2 rounded-md bg-orange-100 px-4 py-3 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            납부 대기 이벤트 {unpaidCount}개가 있습니다
          </span>
        </div>
      )}

      {/* Upcoming events section */}
      <div className="space-y-3">
        {/* Section header row with navigation link */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">예정된 이벤트</h2>
          <Link
            href="/events"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            전체 보기
          </Link>
        </div>

        {/* Render event cards, or an empty state when there are no upcoming events */}
        {upcomingEvents.length > 0 ? (
          <div className="space-y-3">
            {upcomingEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                userRsvpStatus={getDummyRsvp(event.id, CURRENT_USER.id)?.status}
                rsvpCount={getRsvpCount(event.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarX} title="예정된 이벤트가 없습니다" />
        )}
      </div>
    </div>
  );
}
