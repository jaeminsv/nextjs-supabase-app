"use client";

/**
 * Member management interactive Client Component.
 * Handles tab toggle (pending / all members) which requires useState.
 *
 * Receives pre-fetched profile data from the Server Component (page.tsx).
 * Action buttons: approve, reject (with confirm dialog), promote, and delete (with confirm dialog).
 */

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
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
import {
  approveMember,
  rejectMember,
  promoteToAdmin,
  deleteMember,
} from "@/actions/members";
import type { Profile, ProfileRole } from "@/lib/types/profile";

// ─── Role Badge ─────────────────────────────────────────────────────────────

/**
 * Returns the appropriate CSS class string for a given role badge.
 * Colors are intentionally subtle to work on both light and dark backgrounds.
 */
function getRoleBadgeClass(role: ProfileRole): string {
  switch (role) {
    case "admin":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "member":
      return "bg-gray-100 text-gray-600 border border-gray-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    default:
      return "";
  }
}

/** Human-readable Korean labels for each role value */
function getRoleLabel(role: ProfileRole): string {
  switch (role) {
    case "admin":
      return "관리자";
    case "member":
      return "회원";
    case "pending":
      return "승인 대기";
    default:
      return role;
  }
}

// ─── KAIST Education Summary ─────────────────────────────────────────────────

/**
 * Builds a concise KAIST education summary string from a profile.
 * Only includes degree types where the graduation year is set.
 * Uses the same short format as the event attendee list.
 *
 * Example output: "BS'04 / MS'10"
 */
function buildEducationSummary(profile: Profile): string {
  // Collect whichever degree labels are available, using 2-digit year suffix
  const parts: string[] = [];
  if (profile.kaist_bs_year)
    parts.push(`BS'${String(profile.kaist_bs_year).slice(2)}`);
  if (profile.kaist_ms_year)
    parts.push(`MS'${String(profile.kaist_ms_year).slice(2)}`);
  if (profile.kaist_phd_year)
    parts.push(`PhD'${String(profile.kaist_phd_year).slice(2)}`);
  return parts.join(" / ");
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

/**
 * Reusable confirmation dialog for destructive delete/reject actions.
 *
 * Wraps shadcn/ui AlertDialog so the trigger button and cancel button are
 * both disabled while the server action is in-flight (isPending=true).
 * This prevents the dialog from closing mid-flight, which would create
 * a confusing UI where the spinner is visible but the dialog has disappeared.
 *
 * Also blocks Escape key and outside-click dismissal while isPending is true,
 * so the admin cannot accidentally close a dialog during a server round-trip.
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
  /** Visual style of the confirm button inside the dialog. Defaults to triggerVariant. */
  confirmVariant?: React.ComponentProps<typeof Button>["variant"];
}

function DeleteConfirmDialog({
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  onConfirm,
  isPending,
  confirmVariant = triggerVariant,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog>
      {/* The trigger renders as the button the admin sees on the card */}
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={triggerVariant} disabled={isPending}>
          {triggerLabel}
        </Button>
      </AlertDialogTrigger>

      {/*
       * Prevent Escape key from closing the dialog while a server action is
       * in-flight. Without this guard, pressing Escape mid-request would dismiss
       * the dialog and leave the admin without feedback on the pending operation.
       *
       * Note: AlertDialog.Content (unlike Dialog.Content) does not support
       * onPointerDownOutside because the spec intentionally prevents outside-click
       * dismissal — no extra handler is needed for that case.
       */}
      <AlertDialogContent
        onEscapeKeyDown={isPending ? (e) => e.preventDefault() : undefined}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/* Cancel is also disabled while in-flight to prevent closing mid-request */}
          <AlertDialogCancel disabled={isPending}>취소</AlertDialogCancel>
          {/*
           * This project's AlertDialogAction wraps Button with asChild, so it
           * accepts a variant prop directly — no className workaround needed.
           */}
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            variant={confirmVariant}
          >
            확인
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Pending Member Card ──────────────────────────────────────────────────────

function PendingCard({ profile }: { profile: Profile }) {
  const educationSummary = buildEducationSummary(profile);

  // Separate transitions so approving one card does not disable the reject button
  // and vice versa. Each button manages its own loading state independently.
  const [isApprovePending, startApproveTransition] = useTransition();
  const [isRejectPending, startRejectTransition] = useTransition();

  /**
   * Calls the approveMember Server Action inside a React transition.
   * startTransition marks the update as non-urgent so the UI stays interactive
   * while the server round-trip completes. isPending becomes true during this time.
   */
  function handleApprove() {
    startApproveTransition(async () => {
      const result = await approveMember(profile.id);
      if (result.error) alert(result.error);
      // On success, revalidatePath in the action triggers a Server Component re-render
      // so the card disappears from the list automatically — no manual state update needed.
    });
  }

  /**
   * Calls the rejectMember Server Action inside a React transition.
   */
  function handleReject() {
    startRejectTransition(async () => {
      const result = await rejectMember(profile.id);
      if (result.error) alert(result.error);
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-semibold">{profile.full_name}</span>
        <Badge className={getRoleBadgeClass("pending")}>
          {getRoleLabel("pending")}
        </Badge>
      </div>
      <div className="mb-1 text-sm text-muted-foreground">
        연락처: {profile.phone}
      </div>
      {educationSummary && (
        <div className="mb-1 text-sm text-muted-foreground">
          KAIST: {educationSummary}
        </div>
      )}
      {profile.company && profile.job_title && (
        <div className="mb-3 text-sm text-muted-foreground">
          직장: {profile.company} · {profile.job_title}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        {/* Approve button uses its own pending state */}
        <Button size="sm" onClick={handleApprove} disabled={isApprovePending}>
          승인
        </Button>
        {/* Reject button is wrapped in a confirmation dialog to prevent accidents */}
        <DeleteConfirmDialog
          triggerLabel="반려"
          triggerVariant="outline"
          confirmVariant="outline"
          title="반려 확인"
          description="이 회원 신청을 반려하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          onConfirm={handleReject}
          isPending={isRejectPending}
        />
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({ profile }: { profile: Profile }) {
  const joinDate = new Date(profile.created_at).toLocaleDateString("ko-KR");
  // Build KAIST education summary using the same format as the event attendee list
  const educationSummary = buildEducationSummary(profile);

  // Track promotion and deletion loading states independently
  const [isPromotePending, startPromoteTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  /**
   * Calls the promoteToAdmin Server Action inside a React transition.
   * After success, revalidatePath in the action refreshes the member list.
   */
  function handlePromote() {
    startPromoteTransition(async () => {
      const result = await promoteToAdmin(profile.id);
      if (result.error) alert(result.error);
    });
  }

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

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <UserAvatar displayName={profile.display_name} size="sm" />
        <div className="flex items-center gap-2">
          <span className="font-semibold">{profile.display_name}</span>
          <Badge className={getRoleBadgeClass(profile.role)}>
            {getRoleLabel(profile.role)}
          </Badge>
        </div>
      </div>
      <div className="mb-1 text-sm text-muted-foreground">
        가입일: {joinDate}
      </div>
      {/* Show KAIST education summary if any degree year is available */}
      {educationSummary && (
        <div className="mb-1 text-sm text-muted-foreground">
          KAIST: {educationSummary}
        </div>
      )}
      {/* Show company and/or job title if at least one is available */}
      {(profile.company || profile.job_title) && (
        <div className="mb-3 text-sm text-muted-foreground">
          직장:{" "}
          {[profile.company, profile.job_title].filter(Boolean).join(" · ")}
        </div>
      )}
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
          confirmVariant="destructive"
          title="회원 삭제"
          description={`${profile.display_name}님을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          onConfirm={handleDelete}
          isPending={isDeletePending}
        />
      </div>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

interface MemberManagementClientProps {
  profiles: Profile[];
}

export function MemberManagementClient({
  profiles,
}: MemberManagementClientProps) {
  // Track which tab is currently active: pending approvals or all members
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  // Prevents duplicate PDF downloads when the button is clicked rapidly
  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * Generates and downloads a PDF of all members.
   * Uses dynamic import so jsPDF is not included in the initial page bundle.
   */
  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const { generateMemberListPdf } = await import("@/lib/utils/pdf");
      await generateMemberListPdf(profiles);
    } finally {
      setIsDownloading(false);
    }
  };

  // Split profiles into two groups based on role
  const pendingMembers = profiles.filter((p) => p.role === "pending");
  const allMembers = profiles.filter((p) => p.role !== "pending");

  return (
    <div className="relative min-h-full">
      {/* Page title row — title on left, PDF download button on right */}
      <div className="flex items-center justify-between px-4 pt-4">
        <h1 className="text-2xl font-bold">회원 관리</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
        >
          {isDownloading ? "생성 중..." : "PDF 다운로드"}
        </Button>
      </div>

      {/* Tab toggle — switches between pending approvals and all members */}
      <div role="tablist" className="mt-4 flex border-b">
        <button
          role="tab"
          onClick={() => setActiveTab("pending")}
          aria-selected={activeTab === "pending"}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "pending"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          승인 대기 ({pendingMembers.length})
        </button>
        <button
          role="tab"
          onClick={() => setActiveTab("all")}
          aria-selected={activeTab === "all"}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === "all"
              ? "border-b-2 border-primary font-semibold"
              : "text-muted-foreground"
          }`}
        >
          전체 회원 ({allMembers.length})
        </button>
      </div>

      {/* Tab content — renders either pending cards or member cards */}
      <div className="space-y-3 p-4">
        {activeTab === "pending" ? (
          pendingMembers.length > 0 ? (
            pendingMembers.map((profile) => (
              <PendingCard key={profile.id} profile={profile} />
            ))
          ) : (
            <EmptyState icon={Users} title="승인 대기 중인 회원이 없습니다" />
          )
        ) : allMembers.length > 0 ? (
          allMembers.map((profile) => (
            <MemberCard key={profile.id} profile={profile} />
          ))
        ) : (
          <EmptyState icon={Users} title="등록된 회원이 없습니다" />
        )}
      </div>
    </div>
  );
}
