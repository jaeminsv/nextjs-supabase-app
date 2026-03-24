# Member Delete Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken reject button and add a permanent delete button (with confirmation dialog) to the admin member management page.

**Architecture:** Fix `rejectMember` in `actions/members.ts` to use `{ count: 'exact' }` so silent RLS failures surface as errors. Add `deleteMember` with a self-deletion guard. In `member-management-client.tsx`, add a reusable `DeleteConfirmDialog` (wraps shadcn/ui `AlertDialog`) and wire it into both `PendingCard` and `MemberCard`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Server Client, shadcn/ui (`AlertDialog`, `Button`), React `useTransition`

**Spec:** `docs/superpowers/specs/2026-03-24-member-delete-button-design.md`

---

## Chunk 1: Server Actions

### Task 1: Fix `rejectMember` to surface silent RLS failures

**Files:**

- Modify: `actions/members.ts`

- [ ] **Step 1: Update `rejectMember` to use `{ count: 'exact' }` and check the result**

Open `actions/members.ts`. Find the delete block inside `rejectMember` (look for `.delete().eq("id", profileId).eq("role", "pending")`):

```typescript
// Before (silent failure on RLS block):
const { error } = await supabase
  .from("profiles")
  .delete()
  .eq("id", profileId)
  .eq("role", "pending");

if (error) return { error: error.message };
```

Replace **only those two lines** with (keep `revalidatePath` and `return { success: true }` below unchanged):

```typescript
// After: count:'exact' makes Supabase return the number of deleted rows.
// If count === 0 the RLS policy blocked the delete (or the row no longer exists).
const { error, count } = await supabase
  .from("profiles")
  .delete({ count: "exact" })
  .eq("id", profileId)
  .eq("role", "pending");

if (error) return { error: error.message };
if (count === 0)
  return { error: "해당 회원을 찾을 수 없거나 이미 처리되었습니다" };
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add actions/members.ts
git commit -m "fix(members): surface silent RLS failure in rejectMember using count:exact"
```

---

### Task 2: Add `deleteMember` server action

**Files:**

- Modify: `actions/members.ts`

- [ ] **Step 1: Add the `deleteMember` export to `actions/members.ts`**

Append after the `promoteToAdmin` function:

```typescript
/**
 * Permanently deletes any member's profile row from the database.
 *
 * Unlike rejectMember (pending-only), this has no role guard and can remove
 * approved members and admins.
 *
 * IMPORTANT: This only deletes the profiles row, NOT the auth.users record.
 * The user's auth identity remains in Supabase Auth. Only their app profile
 * and access are removed.
 *
 * Self-deletion is blocked: an admin cannot delete their own profile.
 *
 * @param profileId - UUID of the profile to permanently delete
 */
export async function deleteMember(
  profileId: string,
): Promise<{ success?: true; error?: string }> {
  // Step 1: Verify the caller is authenticated
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Unauthorized" };

  // Step 2: Verify the caller has the 'admin' role
  const role = await getCurrentUserRole(userId);
  if (role !== "admin") return { error: "Unauthorized" };

  // Step 3: Block self-deletion — an admin deleting their own profile would
  // lock them out of the app and could leave no admins in the system
  if (profileId === userId)
    return { error: "자신의 계정은 삭제할 수 없습니다" };

  // Step 4: Delete the profiles row with count:'exact' so we know if RLS
  // silently blocked the operation
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("profiles")
    .delete({ count: "exact" })
    .eq("id", profileId);

  if (error) return { error: error.message };
  if (count === 0) return { error: "해당 회원을 찾을 수 없습니다" };

  // Step 5: Revalidate the admin members page so the card disappears
  revalidatePath("/admin/members");
  return { success: true };
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add actions/members.ts
git commit -m "feat(members): add deleteMember server action with self-deletion guard"
```

---

## Chunk 2: UI — DeleteConfirmDialog + PendingCard + MemberCard

### Task 3: Add `DeleteConfirmDialog` reusable component

**Files:**

- Modify: `components/member-management-client.tsx`

- [ ] **Step 1: Add `AlertDialog` imports at the top of `member-management-client.tsx`**

The file currently imports from `lucide-react`, `@/components/ui/badge`, etc.
Add the AlertDialog imports right after the existing UI imports:

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
```

- [ ] **Step 2: Add the `DeleteConfirmDialog` component definition**

Insert this new component right before the `// ─── Pending Member Card ──` section:

```typescript
// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

/**
 * Reusable confirmation dialog for destructive delete/reject actions.
 *
 * Wraps shadcn/ui AlertDialog so the trigger button and cancel button are
 * both disabled while the server action is in-flight (isPending=true).
 * This prevents the dialog from closing mid-flight, which would create
 * a confusing UI where the spinner is visible but the dialog has disappeared.
 */
interface DeleteConfirmDialogProps {
  /** Label shown on the trigger button (e.g. "반려", "삭제") */
  triggerLabel: string;
  /** Visual style of the trigger button */
  triggerVariant?: React.ComponentProps<typeof Button>["variant"];
  /** Heading shown inside the dialog */
  title: string;
  /** Body text warning the admin about the consequences */
  description: string;
  /** Called when the admin clicks the confirm button inside the dialog */
  onConfirm: () => void;
  /** When true, disables both the trigger button and the cancel button */
  isPending: boolean;
}

function DeleteConfirmDialog({
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  onConfirm,
  isPending,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog>
      {/* The trigger renders as the button the admin sees on the card */}
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={triggerVariant} disabled={isPending}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/* Cancel is also disabled while in-flight to prevent closing mid-request */}
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

### Task 4: Update `PendingCard` — split transitions and wrap reject button

**Files:**

- Modify: `components/member-management-client.tsx`

- [ ] **Step 1: Split the single `useTransition` into two independent ones**

In `PendingCard`, replace:

```typescript
const [isPending, startTransition] = useTransition();
```

With:

```typescript
// Separate transitions so approving one card does not disable the reject button
// and vice versa. Each button manages its own loading state independently.
const [isApprovePending, startApproveTransition] = useTransition();
const [isRejectPending, startRejectTransition] = useTransition();
```

- [ ] **Step 2: Update `handleApprove` to use `startApproveTransition`**

Replace:

```typescript
function handleApprove() {
  startTransition(async () => {
    const result = await approveMember(profile.id);
    if (result.error) alert(result.error);
  });
}
```

With:

```typescript
function handleApprove() {
  startApproveTransition(async () => {
    const result = await approveMember(profile.id);
    if (result.error) alert(result.error);
  });
}
```

- [ ] **Step 3: Update `handleReject` to use `startRejectTransition`**

Replace:

```typescript
function handleReject() {
  startTransition(async () => {
    const result = await rejectMember(profile.id);
    if (result.error) alert(result.error);
  });
}
```

With:

```typescript
function handleReject() {
  startRejectTransition(async () => {
    const result = await rejectMember(profile.id);
    if (result.error) alert(result.error);
  });
}
```

- [ ] **Step 4: Replace the "반려" button with `DeleteConfirmDialog`**

In the JSX return of `PendingCard`, replace:

```typescript
<div className="mt-3 flex gap-2">
  {/* disabled during the server round-trip to prevent double-clicks */}
  <Button size="sm" onClick={handleApprove} disabled={isPending}>
    승인
  </Button>
  <Button
    size="sm"
    variant="outline"
    onClick={handleReject}
    disabled={isPending}
  >
    반려
  </Button>
</div>
```

With:

```typescript
<div className="mt-3 flex gap-2">
  {/* Approve button uses its own pending state */}
  <Button size="sm" onClick={handleApprove} disabled={isApprovePending}>
    승인
  </Button>
  {/* Reject button is wrapped in a confirmation dialog to prevent accidents */}
  <DeleteConfirmDialog
    triggerLabel="반려"
    triggerVariant="outline"
    title="반려 확인"
    description="이 회원 신청을 반려하시겠습니까? 이 작업은 되돌릴 수 없습니다."
    onConfirm={handleReject}
    isPending={isRejectPending}
  />
</div>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

---

### Task 5: Update `MemberCard` — add delete button with confirmation

**Files:**

- Modify: `components/member-management-client.tsx`

- [ ] **Step 1: Import `deleteMember` at the top of the file**

The file currently imports from `@/actions/members`:

```typescript
import { approveMember, rejectMember, promoteToAdmin } from "@/actions/members";
```

Update to:

```typescript
import {
  approveMember,
  rejectMember,
  promoteToAdmin,
  deleteMember,
} from "@/actions/members";
```

- [ ] **Step 2: Add a separate `useTransition` and `handleDelete` to `MemberCard`**

`MemberCard` currently has one `useTransition` for promotion.
Add a second one for deletion, and add the `handleDelete` function:

```typescript
// Track promotion and deletion loading states independently
const [isPromotePending, startPromoteTransition] = useTransition();
const [isDeletePending, startDeleteTransition] = useTransition();
```

Update the existing `handlePromote` to use `startPromoteTransition`:

```typescript
function handlePromote() {
  startPromoteTransition(async () => {
    const result = await promoteToAdmin(profile.id);
    if (result.error) alert(result.error);
  });
}
```

Add `handleDelete` after `handlePromote`:

```typescript
/**
 * Calls deleteMember Server Action inside a React transition.
 * Only invoked after the admin confirms in the AlertDialog.
 */
function handleDelete() {
  startDeleteTransition(async () => {
    const result = await deleteMember(profile.id);
    if (result.error) alert(result.error);
  });
}
```

- [ ] **Step 3: Update the JSX return of `MemberCard` to add the delete button**

The current button section in `MemberCard` return:

```typescript
{/* Only 'member' role users can be promoted to admin */}
{profile.role === "member" && (
  <Button
    size="sm"
    variant="outline"
    onClick={handlePromote}
    disabled={isPending}
  >
    관리자 승격
  </Button>
)}
```

Replace with:

```typescript
<div className="mt-3 flex gap-2">
  {/* Only 'member' role users can be promoted to admin */}
  {profile.role === "member" && (
    <Button
      size="sm"
      variant="outline"
      onClick={handlePromote}
      disabled={isPromotePending}
    >
      관리자 승격
    </Button>
  )}
  {/* Delete button is shown for all roles (member and admin alike) */}
  <DeleteConfirmDialog
    triggerLabel="삭제"
    triggerVariant="destructive"
    title="회원 삭제"
    description={`${profile.display_name}님을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
    onConfirm={handleDelete}
    isPending={isDeletePending}
  />
</div>
```

- [ ] **Step 4: Run full checks**

```bash
npm run check-all
```

Expected: lint, typecheck, and format checks all pass.

- [ ] **Step 5: Start the dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/admin/members` and verify:

1. **승인 대기 탭** — "반려" 버튼 클릭 시 확인 다이얼로그가 열림. "확인" 클릭 시 카드가 목록에서 사라짐.
2. **전체 회원 탭** — 각 카드에 "삭제" 버튼이 표시됨. 클릭 시 회원 이름이 포함된 확인 다이얼로그가 열림. "확인" 클릭 시 카드가 사라짐.
3. **자기 자신 삭제 시도** — 본인 카드의 삭제를 시도하면 "자신의 계정은 삭제할 수 없습니다" 알림이 표시됨.

- [ ] **Step 6: Commit**

`actions/members.ts` was already committed in Chunk 1 — only stage the UI file:

```bash
git add components/member-management-client.tsx
git commit -m "feat(members): add delete button with AlertDialog confirmation to admin member management"
```
