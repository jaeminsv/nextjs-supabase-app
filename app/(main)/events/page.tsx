"use client";

/**
 * Event list page — shows upcoming and past events with a tab toggle.
 *
 * Uses dummy data (Phase 2). Phase 3 will replace with real Supabase queries.
 *
 * Tab logic:
 * - Upcoming: status === 'published' AND start_at is in the future
 * - Past: status === 'completed' OR status === 'cancelled' (draft is excluded)
 *
 * FAB (floating action button):
 * - Phase 2: always visible
 * - Phase 3 TODO: show only for admin/organizer role
 */

import { useState } from "react";
import Link from "next/link";
import { CalendarX, Plus } from "lucide-react";
import {
  DUMMY_EVENTS,
  DUMMY_RSVPS,
  CURRENT_USER,
  getDummyRsvp,
} from "@/lib/dummy-data";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function EventsPage() {
  // Track which tab is currently active: upcoming or past events
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  // Use the current time as the boundary between upcoming and past events
  const now = new Date();

  // Filter upcoming: published status AND start date is in the future
  const upcomingEvents = DUMMY_EVENTS.filter(
    (e) => e.status === "published" && new Date(e.start_at) > now,
  ).sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
  );

  // Filter past: completed or cancelled (exclude draft)
  const pastEvents = DUMMY_EVENTS.filter(
    (e) => e.status === "completed" || e.status === "cancelled",
  ).sort(
    (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
  );

  // Show the correct list based on the active tab
  const displayEvents = activeTab === "upcoming" ? upcomingEvents : pastEvents;

  // Helper: count confirmed attendees (going RSVPs) for a given event
  const getRsvpCount = (id: string) =>
    DUMMY_RSVPS.filter((r) => r.event_id === id && r.status === "going").length;

  return (
    <div className="relative min-h-full">
      {/* Tab toggle row — switches between upcoming and past events */}
      {/* role="tablist" wraps the tabs; each button has role="tab" for aria-selected support */}
      <div role="tablist" className="flex border-b">
        <button
          role="tab"
          onClick={() => setActiveTab("upcoming")}
          aria-selected={activeTab === "upcoming"}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "upcoming"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          예정
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab("past")}
          aria-selected={activeTab === "past"}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "past"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          지난
        </button>
      </div>

      {/* Event list — renders cards or an empty state */}
      <div className="space-y-3 p-4">
        {displayEvents.length > 0 ? (
          displayEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              userRsvpStatus={getDummyRsvp(event.id, CURRENT_USER.id)?.status}
              rsvpCount={getRsvpCount(event.id)}
            />
          ))
        ) : (
          <EmptyState
            icon={CalendarX}
            title={
              activeTab === "upcoming"
                ? "예정된 이벤트가 없습니다"
                : "지난 이벤트가 없습니다"
            }
          />
        )}
      </div>

      {/* FAB: floating action button to navigate to event creation form */}
      {/* Phase 2: always visible — Phase 3 TODO: show only for admin/organizer role */}
      <Link
        href="/events/new"
        aria-label="새 이벤트 만들기"
        className="fixed bottom-20 right-4"
      >
        <Button
          size="icon"
          aria-label="새 이벤트 만들기"
          className="h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
