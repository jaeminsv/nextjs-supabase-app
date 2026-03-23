"use client";

/**
 * Member management interactive Client Component.
 * Handles tab toggle (pending / all members) which requires useState.
 *
 * Receives pre-fetched profile data from the Server Component (page.tsx).
 * Action buttons (approve, reject, promote) are wired in Task 015.
 */

import { useState, useTransition } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { approveMember, rejectMember, promoteToAdmin } from "@/actions/members";
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
 *
 * Example output: "학사 2010 · 석사 2012"
 */
function buildEducationSummary(profile: Profile): string {
  const parts: string[] = [];
  if (profile.kaist_bs_year) parts.push(`학사 ${profile.kaist_bs_year}`);
  if (profile.kaist_ms_year) parts.push(`석사 ${profile.kaist_ms_year}`);
  if (profile.kaist_phd_year) parts.push(`박사 ${profile.kaist_phd_year}`);
  return parts.join(" · ");
}

// ─── Pending Member Card ──────────────────────────────────────────────────────

function PendingCard({ profile }: { profile: Profile }) {
  const educationSummary = buildEducationSummary(profile);

  // useTransition gives us isPending (loading state) and startTransition (non-blocking wrapper).
  // Each PendingCard manages its own loading state independently so clicking one card
  // does not disable buttons on other cards.
  const [isPending, startTransition] = useTransition();

  /**
   * Calls the approveMember Server Action inside a React transition.
   * startTransition marks the update as non-urgent so the UI stays interactive
   * while the server round-trip completes. isPending becomes true during this time.
   */
  function handleApprove() {
    startTransition(async () => {
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
    startTransition(async () => {
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
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({ profile }: { profile: Profile }) {
  const joinDate = new Date(profile.created_at).toLocaleDateString("ko-KR");

  // Each MemberCard tracks its own promotion loading state independently
  const [isPending, startTransition] = useTransition();

  /**
   * Calls the promoteToAdmin Server Action inside a React transition.
   * After success, revalidatePath in the action refreshes the member list.
   */
  function handlePromote() {
    startTransition(async () => {
      const result = await promoteToAdmin(profile.id);
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
      <div className="mb-3 text-sm text-muted-foreground">
        가입일: {joinDate}
      </div>
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
