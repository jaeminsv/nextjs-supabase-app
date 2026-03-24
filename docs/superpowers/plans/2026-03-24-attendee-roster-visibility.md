# Attendee Roster Visibility Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict attendee roster visibility to confirmed payers, admins, and organizers — replacing the current "any going RSVP can see it" behavior.

**Architecture:** Introduce a `RosterAccess` enum (`"hidden" | "pending" | "visible"`) computed server-side in `page.tsx`, passed as a single prop to `EventDetailClient`, which renders one of three states. Paid-event attendee queries are replaced with a new `getConfirmedAttendeeProfiles()` that joins `payments(confirmed)` → `profiles`. `AttendeeProfile` is moved to `lib/types/attendee.ts` to prevent a circular import between `lib/queries/events.ts` and `app/(main)/events/[id]/page.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (server client), Tailwind CSS / shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-24-attendee-roster-visibility-design.md`

---

## Chunk 1: Shared Types

### Task 1: Move `AttendeeProfile` and add `RosterAccess` to `lib/types/attendee.ts`

**Files:**

- Create: `lib/types/attendee.ts`
- Modify: `app/(main)/events/[id]/page.tsx` (update import source)
- Modify: `components/event-detail-client.tsx` (update import source)

**Why this task first:** `lib/queries/events.ts` needs `AttendeeProfile` for the new query function. But `page.tsx` (which currently defines `AttendeeProfile`) already imports from `lib/queries/events.ts`. Moving the type to `lib/types/` breaks that circular dependency before it forms.

- [ ] **Step 1: Create `lib/types/attendee.ts`**

```typescript
/**
 * Shared types for the attendee roster feature.
 * Kept in lib/types/ so both lib/queries/ and app/ can import without circular deps.
 */

// Minimal profile fields shown in the attendee list (subset of the full Profile type)
export interface AttendeeProfile {
  id: string;
  display_name: string;
  kaist_bs_year: number | null;
  kaist_ms_year: number | null;
  kaist_phd_year: number | null;
  company: string | null;
  job_title: string | null;
}

// Controls how the attendee roster section is rendered for the current viewer.
// "hidden"  — the section is not rendered at all
// "pending" — section shows a "payment pending confirmation" message, no list
// "visible" — section shows the full attendee list
export type RosterAccess = "hidden" | "pending" | "visible";
```

- [ ] **Step 2: Update `app/(main)/events/[id]/page.tsx` — remove old type definitions and fix import**

Find and remove the `AttendeeProfile` interface and its JSDoc comment. It currently looks like this (around line 14):

```typescript
// Minimal profile fields shown in the attendee list (subset of the full Profile type)
export interface AttendeeProfile {
  id: string;
  display_name: string;
  kaist_bs_year: number | null;
  kaist_ms_year: number | null;
  kaist_phd_year: number | null;
  company: string | null;
  job_title: string | null;
}
```

Replace it with an import from the new types file:

```typescript
import type { AttendeeProfile, RosterAccess } from "@/lib/types/attendee";
```

- [ ] **Step 3: Update `components/event-detail-client.tsx` — fix import source**

Find this import (around line 33):

```typescript
import type { AttendeeProfile } from "@/app/(main)/events/[id]/page";
```

Replace it with:

```typescript
import type { AttendeeProfile, RosterAccess } from "@/lib/types/attendee";
```

- [ ] **Step 4: Run TypeScript type check**

```bash
npm run typecheck
```

Expected: no errors. The types are now in a neutral location that both `lib/` and `app/` can safely import.

- [ ] **Step 5: Commit**

```bash
git add lib/types/attendee.ts app/\(main\)/events/\[id\]/page.tsx components/event-detail-client.tsx
git commit -m "♻️ refactor: move AttendeeProfile to lib/types/attendee and add RosterAccess type"
```

---

## Chunk 2: Query Layer

### Task 2: Add `getConfirmedAttendeeProfiles` to `lib/queries/events.ts`

**Files:**

- Modify: `lib/queries/events.ts`

- [ ] **Step 1: Add the `AttendeeProfile` import to `lib/queries/events.ts`**

The existing imports at the top of the file look like this:

```typescript
import { createClient } from "@/lib/supabase/server";
import type { Event, EventOrganizer } from "@/lib/types/event";
import type { Rsvp } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";
```

Add the new import below the existing ones:

```typescript
import type { AttendeeProfile } from "@/lib/types/attendee";
```

- [ ] **Step 2: Add `getConfirmedAttendeeProfiles` at the end of `lib/queries/events.ts`**

```typescript
/**
 * Returns profiles of attendees who have a confirmed payment for the given event.
 *
 * Used for paid events (fee_amount > 0) to populate the attendee roster.
 * Queries the payments table filtered by status = "confirmed",
 * then joins profiles directly via user_id (no rsvps join needed).
 *
 * @param eventId - UUID of the event to fetch confirmed attendees for
 * @returns Array of AttendeeProfile objects, or empty array on error
 */
export async function getConfirmedAttendeeProfiles(
  eventId: string,
): Promise<AttendeeProfile[]> {
  try {
    const supabase = await createClient();

    // Fetch payments with status "confirmed" for this event,
    // and join the profile fields we need for the roster display.
    const { data, error } = await supabase
      .from("payments")
      .select(
        "profile:profiles(id, display_name, kaist_bs_year, kaist_ms_year, kaist_phd_year, company, job_title)",
      )
      .eq("event_id", eventId)
      .eq("status", "confirmed");

    if (error) {
      console.error("getConfirmedAttendeeProfiles error:", error);
      return [];
    }

    // Flatten the nested profile objects, filtering out any rows with no profile data
    return (data ?? []).flatMap((r) =>
      r.profile ? [r.profile as unknown as AttendeeProfile] : [],
    );
  } catch (err) {
    console.error("getConfirmedAttendeeProfiles unexpected error:", err);
    return [];
  }
}
```

- [ ] **Step 3: Run TypeScript type check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/queries/events.ts
git commit -m "✨ feat: add getConfirmedAttendeeProfiles query for paid event rosters"
```

---

## Chunk 3: Server + Client Components

Tasks 3 and 4 are committed together because `page.tsx` passes a new required prop (`rosterAccess`) that `EventDetailClient` must accept — committing either alone would leave TypeScript in an error state that blocks the pre-commit hook.

### Task 3: Update `page.tsx` — compute `rosterAccess` and branch the attendee query

**Files:**

- Modify: `app/(main)/events/[id]/page.tsx`

- [ ] **Step 1: Add `getConfirmedAttendeeProfiles` to the import from `@/lib/queries/events`**

Current import (around line 8):

```typescript
import {
  getEventById,
  getMyRsvpForEvent,
  getMyPaymentForEvent,
} from "@/lib/queries/events";
```

Update to:

```typescript
import {
  getEventById,
  getMyRsvpForEvent,
  getMyPaymentForEvent,
  getConfirmedAttendeeProfiles,
} from "@/lib/queries/events";
```

- [ ] **Step 2: Replace the `canSeeAttendees` block with `rosterAccess` logic**

Find this block (around line 80):

```typescript
// Determine if the current user is allowed to see the attendee list.
// Access is granted to: members who responded 'going', admins, and organizers.
const canSeeAttendees =
  initialRsvp?.status === "going" || isAdmin || isOrganizer;

// Only fetch attendee profiles when the user has permission to view the list.
// This avoids an unnecessary DB round-trip for users who cannot see the section.
let attendeeProfiles: AttendeeProfile[] = [];
if (canSeeAttendees) {
  const { data: goingRsvps } = await supabase
    .from("rsvps")
    .select(
      "profile:profiles(id, display_name, kaist_bs_year, kaist_ms_year, kaist_phd_year, company, job_title)",
    )
    .eq("event_id", id)
    .eq("status", "going");

  // Flatten the nested profile objects, filtering out any rows with no profile data
  attendeeProfiles = (goingRsvps ?? []).flatMap((r) =>
    r.profile ? [r.profile as unknown as AttendeeProfile] : [],
  );
}
```

Replace the entire block with:

```typescript
// Determine roster access level for the current viewer.
// "visible" — full attendee list shown
// "pending" — section shown with "awaiting payment confirmation" message
// "hidden"  — section not rendered at all
//
// Free events (fee_amount === 0): any going RSVP can see the list.
// Paid events: only confirmed payers (and admins/organizers) can see the list.
//
// Note: hasPendingPayment relies on getMyPaymentForEvent excluding "rejected"
// records. That function filters to ["pending", "confirmed"] only.
// If that contract changes, this logic must be updated accordingly.
const isFreeEvent = event.fee_amount === 0;
const hasConfirmedPayment = initialPayment?.status === "confirmed";
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

// Only fetch attendee profiles when the viewer has full access.
// This avoids an unnecessary DB round-trip for restricted viewers.
let attendeeProfiles: AttendeeProfile[] = [];
if (rosterAccess === "visible") {
  if (isFreeEvent) {
    // Free events: show all going RSVPs
    const { data: goingRsvps } = await supabase
      .from("rsvps")
      .select(
        "profile:profiles(id, display_name, kaist_bs_year, kaist_ms_year, kaist_phd_year, company, job_title)",
      )
      .eq("event_id", id)
      .eq("status", "going");

    attendeeProfiles = (goingRsvps ?? []).flatMap((r) =>
      r.profile ? [r.profile as unknown as AttendeeProfile] : [],
    );
  } else {
    // Paid events: show only attendees with confirmed payment
    attendeeProfiles = await getConfirmedAttendeeProfiles(id);
  }
}
```

- [ ] **Step 3: Add `rosterAccess` prop to the `EventDetailClient` JSX**

Find the return statement (around line 103):

```typescript
  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp ?? undefined}
      initialPayment={initialPayment ?? undefined}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
      attendeeProfiles={attendeeProfiles}
    />
  );
```

Add the `rosterAccess` prop:

```typescript
  return (
    <EventDetailClient
      event={event}
      initialRsvp={initialRsvp ?? undefined}
      initialPayment={initialPayment ?? undefined}
      isAdmin={isAdmin}
      isOrganizer={isOrganizer}
      attendeeProfiles={attendeeProfiles}
      rosterAccess={rosterAccess}
    />
  );
```

### Task 4: Update `EventDetailClient` to use `rosterAccess`

**Files:**

- Modify: `components/event-detail-client.tsx`

- [ ] **Step 4: Add `rosterAccess` to `EventDetailClientProps`**

Current interface (around line 35):

```typescript
interface EventDetailClientProps {
  event: Event;
  // Current user's RSVP for this event (undefined if not yet responded)
  initialRsvp?: Rsvp;
  // Current user's payment record for this event (undefined if not yet paid)
  initialPayment?: Payment;
  // Whether the current user has the 'admin' role — unlocks management actions
  isAdmin: boolean;
  // Whether the current user is listed as an organizer for this specific event
  isOrganizer: boolean;
  // Profiles of all going attendees — only populated when the user has permission to see the list
  attendeeProfiles?: AttendeeProfile[];
}
```

Replace with (keep `isAdmin`/`isOrganizer` — still used for admin action buttons):

```typescript
interface EventDetailClientProps {
  event: Event;
  // Current user's RSVP for this event (undefined if not yet responded)
  initialRsvp?: Rsvp;
  // Current user's payment record for this event (undefined if not yet paid)
  initialPayment?: Payment;
  // Whether the current user has the 'admin' role — unlocks management actions
  isAdmin: boolean;
  // Whether the current user is listed as an organizer for this specific event
  isOrganizer: boolean;
  // Profiles of attendees eligible for display — population depends on rosterAccess and event type
  attendeeProfiles?: AttendeeProfile[];
  // Controls how the attendee roster section is rendered for this viewer
  rosterAccess: RosterAccess;
}
```

- [ ] **Step 5: Destructure `rosterAccess` in the function signature**

Current signature (around line 49):

```typescript
export function EventDetailClient({
  event,
  initialRsvp,
  initialPayment,
  isAdmin,
  isOrganizer,
  attendeeProfiles,
}: EventDetailClientProps) {
```

Add `rosterAccess`:

```typescript
export function EventDetailClient({
  event,
  initialRsvp,
  initialPayment,
  isAdmin,
  isOrganizer,
  attendeeProfiles,
  rosterAccess,
}: EventDetailClientProps) {
```

- [ ] **Step 6: Replace the attendee list section rendering**

Find this entire block (around line 592):

```typescript
        {/* === Attendee List Section === */}
        {/* Visible only to: members who responded 'going', admins, and organizers */}
        {(initialRsvp?.status === "going" || isAdmin || isOrganizer) &&
          attendeeProfiles &&
          attendeeProfiles.length > 0 && (
            <section className="space-y-2 rounded-lg border p-4">
              <h2 className="text-base font-semibold">참가자 명단</h2>
              <ul className="space-y-2">
                {attendeeProfiles.map((profile) => {
                  // Build KAIST graduation year string from whichever degrees are available
                  const kaistParts = [
                    profile.kaist_bs_year
                      ? `BS'${String(profile.kaist_bs_year).slice(2)}`
                      : null,
                    profile.kaist_ms_year
                      ? `MS'${String(profile.kaist_ms_year).slice(2)}`
                      : null,
                    profile.kaist_phd_year
                      ? `PhD'${String(profile.kaist_phd_year).slice(2)}`
                      : null,
                  ].filter(Boolean);
                  const kaistInfo =
                    kaistParts.length > 0 ? kaistParts.join(" / ") : null;

                  // Combine company and job_title into a single line when both are present
                  const companyInfo =
                    profile.company && profile.job_title
                      ? `${profile.company} / ${profile.job_title}`
                      : (profile.company ?? profile.job_title ?? null);

                  return (
                    <li
                      key={profile.id}
                      className="rounded-md bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {profile.display_name}
                      </span>
                      {kaistInfo && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {kaistInfo}
                        </span>
                      )}
                      {companyInfo && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {companyInfo}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
```

Replace with:

```typescript
        {/* === Attendee List Section === */}
        {/* "hidden": render nothing (non-going, unpaid, or rejected payment) */}

        {/* "pending": section is visible but list is locked until payment is confirmed */}
        {rosterAccess === "pending" && (
          <section className="space-y-2 rounded-lg border p-4">
            <h2 className="text-base font-semibold">참가자 명단</h2>
            <p className="text-sm text-muted-foreground">
              납부 확인 후 명단이 공개됩니다.
            </p>
          </section>
        )}

        {/* "visible": full attendee list — only rendered when there are attendees to show */}
        {rosterAccess === "visible" &&
          attendeeProfiles &&
          attendeeProfiles.length > 0 && (
            <section className="space-y-2 rounded-lg border p-4">
              <h2 className="text-base font-semibold">참가자 명단</h2>
              <ul className="space-y-2">
                {attendeeProfiles.map((profile) => {
                  // Build KAIST graduation year string from whichever degrees are available
                  const kaistParts = [
                    profile.kaist_bs_year
                      ? `BS'${String(profile.kaist_bs_year).slice(2)}`
                      : null,
                    profile.kaist_ms_year
                      ? `MS'${String(profile.kaist_ms_year).slice(2)}`
                      : null,
                    profile.kaist_phd_year
                      ? `PhD'${String(profile.kaist_phd_year).slice(2)}`
                      : null,
                  ].filter(Boolean);
                  const kaistInfo =
                    kaistParts.length > 0 ? kaistParts.join(" / ") : null;

                  // Combine company and job_title into a single line when both are present
                  const companyInfo =
                    profile.company && profile.job_title
                      ? `${profile.company} / ${profile.job_title}`
                      : (profile.company ?? profile.job_title ?? null);

                  return (
                    <li
                      key={profile.id}
                      className="rounded-md bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {profile.display_name}
                      </span>
                      {kaistInfo && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {kaistInfo}
                        </span>
                      )}
                      {companyInfo && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {companyInfo}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
```

- [ ] **Step 7: Run full check (Tasks 3 + 4 are now both complete)**

```bash
npm run check-all
```

Expected: all pass (lint + typecheck + format). Fix any issues before committing.

- [ ] **Step 8: Commit Tasks 3 and 4 together**

```bash
git add app/\(main\)/events/\[id\]/page.tsx components/event-detail-client.tsx
git commit -m "✨ feat: restrict attendee roster to confirmed payers via rosterAccess prop"
```

---

## Manual Verification Checklist

After all tasks complete, verify these scenarios in the browser (`npm run dev`):

| Scenario                                                | Expected behavior                                      |
| ------------------------------------------------------- | ------------------------------------------------------ |
| Not logged in                                           | No roster section                                      |
| Logged in, RSVP `maybe` or `not_going`                  | No roster section                                      |
| Logged in, RSVP going, no payment (paid event)          | No roster section                                      |
| Logged in, RSVP going, payment `pending` (paid event)   | Section visible with "납부 확인 후 명단이 공개됩니다." |
| Logged in, RSVP going, payment `confirmed` (paid event) | Full roster — shows only confirmed payers              |
| Logged in, payment `rejected` (paid event)              | No roster section                                      |
| Admin (any event)                                       | Full roster                                            |
| Organizer (their event)                                 | Full roster                                            |
| Free event (`fee_amount = 0`) + RSVP going              | Full roster — shows all going RSVPs                    |
