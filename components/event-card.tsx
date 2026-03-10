import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { EventStatusBadge } from "@/components/event-status-badge";
import type { Event } from "@/lib/types/event";
import type { RsvpStatus } from "@/lib/types/rsvp";

interface EventCardProps {
  event: Event;
  // The current user's RSVP status for this event. null/undefined if not responded.
  userRsvpStatus?: RsvpStatus | null;
  // Number of confirmed attendees (going RSVPs)
  rsvpCount?: number;
}

/**
 * Clickable card showing event summary info.
 * Clicking navigates to the event detail page /events/[id].
 */
export function EventCard({
  event,
  userRsvpStatus,
  rsvpCount = 0,
}: EventCardProps) {
  // Format the start date for Korean locale display (e.g. "4월 15일 오후 3:00")
  const formattedDate = new Date(event.start_at).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Show "N/max명" if capacity is set, otherwise just "N명 참석"
  const capacityText = event.max_capacity
    ? `${rsvpCount}/${event.max_capacity}명`
    : `${rsvpCount}명 참석`;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          {/* Title + event status badge row */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-semibold">
              {event.title}
            </h3>
            <EventStatusBadge status={event.status} />
          </div>

          {/* Date row */}
          <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formattedDate}</span>
          </div>

          {/* Location row */}
          <div className="mb-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{event.location}</span>
          </div>

          {/* Capacity + RSVP status row */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5 shrink-0" />
              <span>{capacityText}</span>
            </div>
            <RsvpStatusBadge status={userRsvpStatus} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
