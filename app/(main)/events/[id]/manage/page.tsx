/**
 * Attendee & fee management page — organizer/admin dashboard for an event.
 *
 * Shows summary stats ("25/30 paid, $750/$900 collected"),
 * attendee list with RSVP + payment status, and confirm/reject actions.
 * Only accessible to event organizers and admins.
 *
 * Phase 2 (Task 008): Replace with actual management UI.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */
export default async function ManageEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">참석자 및 회비 관리</h1>
      <p className="mt-2 text-muted-foreground">이벤트 ID: {id}</p>
    </div>
  );
}
