/**
 * Edit event page — form to modify an existing event.
 *
 * Shares the same form component as the create page,
 * pre-populated with current event data.
 * Only accessible to event creator, organizer, or admin.
 *
 * Phase 2 (Task 007): Replace with actual event edit form UI.
 *
 * Note: Next.js 16 requires params to be awaited as a Promise.
 */
export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">이벤트 수정</h1>
      <p className="mt-2 text-muted-foreground">이벤트 ID: {id}</p>
    </div>
  );
}
