/**
 * Loading UI for the event detail page (/events/[id]).
 *
 * Shown during route-level navigation to the event detail page.
 * Mirrors the structure of the event detail layout: title, metadata, and content sections.
 */

export default function EventDetailLoading() {
  return (
    <div className="space-y-4 p-4">
      {/* Event title skeleton */}
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      {/* Event metadata (date, location) skeletons */}
      <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      {/* Event description / RSVP section skeleton */}
      <div className="h-48 animate-pulse rounded-lg bg-muted" />
      {/* Payment section skeleton */}
      <div className="h-32 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
