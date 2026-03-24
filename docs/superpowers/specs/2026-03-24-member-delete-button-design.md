# Member Delete Button Design

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add permanent delete capability to the admin member management page.

- Fix the broken reject button on the pending tab
- Add a delete button (with confirmation dialog) to both the pending tab and the all-members tab
- Notification to the deleted member is deferred to a later task

---

## Problem Statement

1. **Reject button bug** — The "반려" button on `PendingCard` calls `rejectMember` but the member is not removed from the list. Root cause is likely an RLS policy blocking the delete or a silent error being swallowed.
2. **No delete for approved members** — Admins have no way to remove a fully approved or admin-role member from the system.
3. **No confirmation guard** — Destructive actions (reject, delete) have no confirmation step, risking accidental deletions.

---

## Architecture

### Layers Affected

| Layer         | File                                      | Change                                                              |
| ------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| Server Action | `actions/members.ts`                      | Fix `rejectMember`; add `deleteMember`                              |
| Client UI     | `components/member-management-client.tsx` | Add `DeleteConfirmDialog`; wire into `PendingCard` and `MemberCard` |

### No new files needed — all changes are additive within existing files.

---

## Server Action Layer (`actions/members.ts`)

### `rejectMember` (fix)

- Root cause: Supabase `delete()` does not return an error when zero rows are deleted (RLS blocks silently). Fix by using `.delete({ count: 'exact' })` and checking `count === 0` → return `{ error: "해당 회원을 찾을 수 없거나 이미 처리되었습니다" }`
- Behavior: deletes profiles row where `id = profileId AND role = 'pending'`
- Does NOT delete `auth.users` row (same as existing contract)
- Error handling: `alert()` pattern retained (consistent with existing code — toaster migration is out of scope)

### `deleteMember` (new)

- Same admin-auth guard as all other actions (`getCurrentUserId` + `getCurrentUserRole`)
- **Self-deletion guard:** `if (profileId === userId) return { error: "자신의 계정은 삭제할 수 없습니다" }`
- Deletes profiles row where `id = profileId` — no role restriction
- Uses `.delete({ count: 'exact' })` and checks `count === 0` → return `{ error: "해당 회원을 찾을 수 없습니다" }`
- Does NOT delete `auth.users` row
- Calls `revalidatePath('/admin/members')` on success
- Returns `{ success: true }` or `{ error: string }`
- Error handling: `alert()` pattern retained (consistent with existing code)

---

## UI Layer (`components/member-management-client.tsx`)

### `DeleteConfirmDialog` (new internal component)

Reusable wrapper around shadcn/ui `AlertDialog`.
Props:

```ts
interface DeleteConfirmDialogProps {
  triggerLabel: string; // Button label shown to admin (e.g. "반려", "삭제")
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]; // "outline" for reject, "destructive" for delete
  title: string; // Dialog heading
  description: string; // Warning message shown in dialog body
  onConfirm: () => void; // Called when admin clicks the confirm button
  isPending: boolean; // Disables BOTH trigger and cancel buttons while server action is in-flight
}
```

**Note on `isPending`:** When `isPending` is true, both the trigger button and the `AlertDialogCancel` button must be disabled. This prevents the dialog from closing mid-flight, which would create confusing UI (spinner visible but dialog gone).

### `PendingCard` changes

- **Split `useTransition`:** Separate into `[isApprovePending, startApproveTransition]` and `[isRejectPending, startRejectTransition]` so that approving does not disable the reject button and vice versa
- Wrap existing "반려" `Button` with `DeleteConfirmDialog`
- `triggerVariant="outline"`, title: "반려 확인", description: "이 회원 신청을 반려하시겠습니까? 이 작업은 되돌릴 수 없습니다."
- `onConfirm` calls `handleReject` (which uses `startRejectTransition`)

### `MemberCard` changes

- Add "삭제" `DeleteConfirmDialog` alongside existing "관리자 승격" button
- `triggerVariant="destructive"`, title: "회원 삭제", description: "[display_name]님을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
- `onConfirm` calls new `handleDelete` which calls `deleteMember`
- Shown for ALL members (admin and member roles alike)

---

## Data Flow

```
Admin clicks trigger button
  → AlertDialog opens
  → Admin clicks "확인"
  → onConfirm() fires
  → startTransition(async () => { await rejectMember / deleteMember })
  → isPending = true (button disabled)
  → Server action runs (admin auth check → DB delete → revalidatePath)
  → On success: Server Component re-renders, card disappears
  → On error: alert(error)
```

---

## Error Handling

- Server action errors returned as `{ error: string }` and displayed via `alert()`
- Consistent with existing pattern in `PendingCard` and `MemberCard`
- `isPending` flag disables the trigger button during in-flight requests to prevent double-clicks

---

## Out of Scope

- Deleting `auth.users` record (requires service_role key, not safe in Server Actions)
- Email/in-app notification to deleted member (deferred)
- Bulk delete
- Undo / soft delete
