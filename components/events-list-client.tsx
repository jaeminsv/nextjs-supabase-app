"use client";

/**
 * Client Component for the events list page.
 *
 * Handles the tab toggle (upcoming / past) which requires useState.
 * Event data is fetched by the parent Server Component and passed as props,
 * keeping data fetching on the server and interactivity on the client.
 */

import { useState } from "react";
import Link from "next/link";
import { CalendarX, Plus } from "lucide-react";
import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import type { Event } from "@/lib/types/event";
import type { Rsvp } from "@/lib/types/rsvp";

interface EventsListClientProps {
  // Pre-fetched list of upcoming published events (start_at > now, status='published')
  upcomingEvents: Event[];
  // Pre-fetched list of past events (status in completed, cancelled)
  pastEvents: Event[];
  // The currently authenticated user's ID
  currentUserId: string;
  // Map of eventId → Rsvp for the current user, used to display RSVP status badges
  rsvpMap: Record<string, Rsvp>;
}

export function EventsListClient({
  upcomingEvents,
  pastEvents,
  rsvpMap,
}: EventsListClientProps) {
  // Track which tab is currently active: upcoming or past events
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");

  // Show the correct list based on the active tab
  const displayEvents = activeTab === "upcoming" ? upcomingEvents : pastEvents;

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
              // Look up the current user's RSVP status for this event from the pre-fetched map.
              // Falls back to undefined (shows '미응답') if no RSVP record exists.
              userRsvpStatus={rsvpMap[event.id]?.status ?? undefined}
              rsvpCount={0}
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
      {/* TODO (Task 015): show only for admin/organizer role */}
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
