/**
 * Event detail page — shows full event info, RSVP controls, and fee status.
 *
 * Displays event info, RSVP buttons (going/maybe/not_going) with guest counts,
 * fee breakdown, payment reporting, and shareable event link.
 *
 * Phase 2 (Task 006): Replace with actual event detail UI.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */
export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">이벤트 상세</h1>
      <p className="mt-2 text-muted-foreground">이벤트 ID: {id}</p>
    </div>
  );
}
