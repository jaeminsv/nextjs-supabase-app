/**
 * Create event page — form to create a new event (draft).
 *
 * Includes fields for title, description, date/time, location,
 * fees (member/adult guest/child guest), capacity, and RSVP deadline.
 *
 * Phase 2 (Task 007): Replace with actual event form UI.
 */
export default function CreateEventPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold">이벤트 만들기</h1>
      <p className="mt-2 text-muted-foreground">
        새 이벤트를 생성하는 폼이 표시될 예정입니다.
      </p>
    </div>
  );
}
