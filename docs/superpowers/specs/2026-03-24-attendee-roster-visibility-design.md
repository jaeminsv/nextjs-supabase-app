# Attendee Roster Visibility — Design Spec

**Date:** 2026-03-24
**Status:** Approved

---

## Problem

Currently, any user who RSVPs as "going" can view the attendee roster on the event detail page. The desired behavior is to restrict roster visibility to users who have had their payment confirmed by an admin, as well as admins and organizers. Additionally, the roster content should only show confirmed payers (for paid events).

---

## Requirements

### Viewer Permission (who can see the roster section)

| Condition                                    | Roster visibility                 |
| -------------------------------------------- | --------------------------------- |
| Admin or organizer                           | Visible (full list)               |
| Free event (`fee_amount === 0`) + RSVP going | Visible (full list)               |
| Paid event + payment `confirmed`             | Visible (full list)               |
| Paid event + payment `pending`               | Section shown with locked message |
| Paid event + no payment / RSVP not going     | Section hidden                    |
| RSVP maybe / not_going                       | Section hidden                    |

### Roster Content (who appears in the list)

- **Free events**: all users with `rsvp.status = "going"`
- **Paid events**: only users with `payment.status = "confirmed"`

---

## Design

### New Type: `RosterAccess`

Defined in `app/(main)/events/[id]/page.tsx` (exported, consistent with the existing `AttendeeProfile` export pattern from the same file):

```typescript
// Controls how the attendee roster section is rendered for the current viewer.
// "hidden"  — the section is not rendered at all
// "pending" — section is shown with a "pending confirmation" message, no list
// "visible" — section is fully shown with the attendee list
export type RosterAccess = "hidden" | "pending" | "visible";
```

> **Note on type location**: `RosterAccess` and `AttendeeProfile` are both defined in `page.tsx` and imported by `event-detail-client.tsx`. This is consistent with the existing pattern. If these types grow in scope, moving them to `lib/types/` should be considered in a future refactor.

### Server Component (`page.tsx`)

Replace the existing `canSeeAttendees` boolean with `rosterAccess: RosterAccess` computation:

```typescript
const isFreeEvent = event.fee_amount === 0;
const hasConfirmedPayment = initialPayment?.status === "confirmed";
// Note: hasPendingPayment relies on getMyPaymentForEvent excluding "rejected" records.
// That function filters to ["pending", "confirmed"] only (lib/queries/events.ts).
// If that contract changes, this logic must be updated accordingly.
const hasPendingPayment = initialPayment?.status === "pending";
const isGoing = initialRsvp?.status === "going";

let rosterAccess: RosterAccess = "hidden";

if (isAdmin || isOrganizer) {
  rosterAccess = "visible";
} else if (isFreeEvent && isGoing) {
  rosterAccess = "visible";
} else if (hasConfirmedPayment) {
  rosterAccess = "visible";
} else if (hasPendingPayment) {
  rosterAccess = "pending";
}
```

Attendee query logic:

- Only execute when `rosterAccess === "visible"`
- **Free events**: query `rsvps` filtered by `status = "going"`, join `profiles` (existing query, unchanged)
- **Paid events**: call `getConfirmedAttendeeProfiles(eventId)` — queries `payments` filtered by `status = "confirmed"`, joins `profiles` directly via `user_id`

### Query Layer (`lib/queries/events.ts`)

Add a new exported function. `AttendeeProfile` is imported from `@/app/(main)/events/[id]/page`:

```typescript
/**
 * Returns profiles of users who have a confirmed payment for the given event.
 * Used for paid events only (fee_amount > 0).
 * Queries the payments table filtered by status = "confirmed",
 * then joins profiles directly via user_id (no rsvps join needed).
 */
export async function getConfirmedAttendeeProfiles(
  eventId: string,
): Promise<AttendeeProfile[]>;
```

### Client Component (`event-detail-client.tsx`)

Add `rosterAccess` prop. Keep `isAdmin` and `isOrganizer` props — they are still used for the admin action buttons ("이벤트 수정", "참석자 & 회비 관리") and are unrelated to roster visibility.

```typescript
interface EventDetailClientProps {
  // ... existing props (isAdmin, isOrganizer remain for admin action buttons) ...
  rosterAccess: RosterAccess; // replaces the inline going/admin/organizer check for the roster section
}
```

Replace the inline `(initialRsvp?.status === "going" || isAdmin || isOrganizer)` condition in the roster section with three-way rendering:

```tsx
{
  /* "hidden": render nothing */
}

{
  /* "pending": show section with locked message */
}
{
  rosterAccess === "pending" && (
    <section className="space-y-2 rounded-lg border p-4">
      <h2 className="text-base font-semibold">참가자 명단</h2>
      <p className="text-sm text-muted-foreground">
        납부 확인 후 명단이 공개됩니다.
      </p>
    </section>
  );
}

{
  /* "visible": show full attendee list (existing markup) */
}
{
  rosterAccess === "visible" &&
    attendeeProfiles &&
    attendeeProfiles.length > 0 && <section>...</section>;
}
```

---

## Files Changed

| File                                 | Change                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `app/(main)/events/[id]/page.tsx`    | Add `RosterAccess` type; replace `canSeeAttendees` with `rosterAccess`; branch attendee query by free/paid; pass `rosterAccess` prop |
| `components/event-detail-client.tsx` | Add `rosterAccess` prop; replace inline condition with three-way render; keep `isAdmin`/`isOrganizer` for admin buttons              |
| `lib/queries/events.ts`              | Add `getConfirmedAttendeeProfiles(eventId)` function                                                                                 |

---

## Edge Cases

- **Admin / organizer on a paid event with no confirmed payments yet**: `rosterAccess = "visible"`, but `attendeeProfiles` is empty, so the section is hidden by the `length > 0` guard. This is intentional — admins can see the full roster via the manage page. If an empty-state message is needed in the future, it can be added then.
- **Free event, zero fee but payment record exists**: treated as free (`fee_amount === 0`) — payment record is ignored for roster access.
- **Rejected payment**: `getMyPaymentForEvent` excludes `rejected` records (filters to `["pending", "confirmed"]` only), so `initialPayment` will be `null` for rejected payments. This means `hasPendingPayment` and `hasConfirmedPayment` are both false → `rosterAccess = "hidden"`. This behavior depends on `getMyPaymentForEvent` maintaining its current filter contract.
