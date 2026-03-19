/**
 * Loading UI for the (main) route group.
 *
 * This file is shown automatically by Next.js App Router during page-level
 * navigation (route transitions) before the new page is ready to render.
 *
 * Note: This is different from Suspense fallbacks — Suspense handles component-level
 * data loading within a page, while loading.tsx handles route-level transitions.
 */

export default function Loading() {
  return (
    // Generic skeleton that works across all main pages during navigation
    <div className="space-y-4 p-4">
      {/* Page title skeleton */}
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      {/* Content card skeletons */}
      <div className="space-y-3">
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-24 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}
