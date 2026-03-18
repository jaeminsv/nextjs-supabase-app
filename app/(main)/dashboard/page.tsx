// Dashboard page — Server Component (no 'use client' needed)
// Shows a greeting, unpaid event alert placeholder, and list of upcoming events.
//
// NOTE (cacheComponents mode): Supabase data fetching is isolated inside
// <DashboardContent> which is wrapped in <Suspense>. This satisfies the
// Next.js 16 cacheComponents requirement that uncached data access must
// happen inside a Suspense boundary.

import { Suspense } from "react";
import Link from "next/link";
import { AlertCircle, CalendarX } from "lucide-react";
import { getUpcomingEvents, getUserRsvpsForEvents } from "@/lib/queries/events";
import { createClient } from "@/lib/supabase/server";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";

/**
 * Inner async component that fetches all uncached data.
 * Must be wrapped in <Suspense> by the parent page component.
 */
async function DashboardContent() {
  const supabase = await createClient();

  // Read the current user's ID from the JWT cookie without a network call.
  // getClaims() is preferred over getUser() to avoid Auth API rate limits (429 errors).
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub ?? null;

  // Fetch the display_name from the profiles table for a personalised greeting
  let displayName = "회원";
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .single();

    if (profile?.display_name) {
      displayName = profile.display_name;
    }
  }

  // Fetch upcoming published events from Supabase (already filtered + sorted by the query)
  const allUpcomingEvents = await getUpcomingEvents();

  // Show only the nearest 5 upcoming events on the dashboard
  const upcomingEvents = allUpcomingEvents.slice(0, 5);

  // Fetch the current user's RSVPs for all visible events in a single query.
  // This gives us a map of { eventId -> Rsvp } for O(1) badge lookups below.
  const eventIds = upcomingEvents.map((e) => e.id);
  const rsvpMap = await getUserRsvpsForEvents(eventIds);

  // Payment/RSVP counts will be wired up in Task 014.
  // For now, the unpaid banner is hidden (unpaidCount = 0).
  const unpaidCount = 0;

  return (
    <div className="space-y-4 p-4">
      {/* Greeting header — shows the current user's display name */}
      <h1 className="text-2xl font-bold">안녕하세요, {displayName}님!</h1>

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
                // Look up the user's RSVP status for this specific event from the map.
                // undefined means the user hasn't responded yet (no badge shown).
                userRsvpStatus={rsvpMap[event.id]?.status ?? undefined}
                rsvpCount={0}
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

/**
 * Dashboard page shell.
 * Wraps the data-fetching content in Suspense as required by cacheComponents mode.
 */
export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-4">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
            <div className="h-24 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
