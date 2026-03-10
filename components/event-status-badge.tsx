import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EventStatus } from "@/lib/types/event";

// Props for the event status badge component
interface EventStatusBadgeProps {
  // The current lifecycle status of the event. Always required — events always have a status.
  status: EventStatus;
}

// Maps each event lifecycle status to its display label and Tailwind color classes
const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> =
  {
    draft: {
      label: "초안",
      className: "bg-gray-100 text-gray-600 border border-gray-200",
    },
    published: {
      label: "모집중",
      className: "bg-blue-100 text-blue-800 border border-blue-200",
    },
    cancelled: {
      label: "취소됨",
      className: "bg-red-100 text-red-800 border border-red-200",
    },
    completed: {
      label: "완료",
      className: "bg-gray-100 text-gray-600 border border-gray-200",
    },
  };

/**
 * Displays an event's current lifecycle state as a colored badge.
 * Gray = draft or completed, Blue = actively accepting RSVPs, Red = cancelled.
 */
export function EventStatusBadge({ status }: EventStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return <Badge className={cn(config.className)}>{config.label}</Badge>;
}
