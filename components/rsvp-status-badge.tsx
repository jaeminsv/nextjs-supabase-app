import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RsvpStatus } from "@/lib/types/rsvp";

// Props for the RSVP status badge component
interface RsvpStatusBadgeProps {
  // The current RSVP status of the user. null/undefined means no response yet.
  status: RsvpStatus | null | undefined;
}

// Maps each RSVP status to its display label and Tailwind color classes
const STATUS_CONFIG: Record<RsvpStatus, { label: string; className: string }> =
  {
    going: {
      label: "참석",
      className: "bg-green-100 text-green-800 border border-green-200",
    },
    maybe: {
      label: "미정",
      className: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    },
    not_going: {
      label: "불참",
      className: "bg-gray-100 text-gray-600 border border-gray-200",
    },
  };

// Default config for when status is null/undefined (user hasn't responded yet)
const DEFAULT_CONFIG = {
  label: "미응답",
  className: "bg-gray-100 text-gray-600 border border-gray-200",
};

/**
 * Displays the user's RSVP status as a colored badge.
 * Green = attending, Yellow = maybe, Gray = not attending or no response.
 */
export function RsvpStatusBadge({ status }: RsvpStatusBadgeProps) {
  const config = status
    ? (STATUS_CONFIG[status] ?? DEFAULT_CONFIG)
    : DEFAULT_CONFIG;

  return <Badge className={cn(config.className)}>{config.label}</Badge>;
}
