"use client";

/**
 * Member management page — admin-only.
 *
 * Tabs:
 * - "승인 대기": Lists users with role "pending". Admin can approve or reject.
 * - "전체 회원": Lists all approved members. Admin can promote to admin role.
 *
 * Phase 2 (Task 009): Uses dummy data. Phase 3 will replace with real Supabase queries.
 */

import { useState } from "react";
import { Users } from "lucide-react";
import { ALL_PROFILES } from "@/lib/dummy-data";
import type { Profile, ProfileRole } from "@/lib/types/profile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";

// ─── Role Badge ─────────────────────────────────────────────────────────────

/**
 * Returns the appropriate CSS class string for a given role badge.
 * Colors are intentionally subtle to work on both light and dark backgrounds.
 */
function getRoleBadgeClass(role: ProfileRole): string {
  switch (role) {
    case "admin":
      // Blue tone — signifies elevated admin privilege
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "member":
      // Neutral gray — standard approved member
      return "bg-gray-100 text-gray-600 border border-gray-200";
    case "pending":
      // Yellow/amber tone — waiting for approval
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
 * Example output: "학사 2012 · 박사 2018"
 * Returns an empty string if no KAIST degree information is available.
 */
function buildEducationSummary(profile: Profile): string {
  const parts: string[] = [];

  // Include Bachelor's year if available
  if (profile.kaist_bs_year) {
    parts.push(`학사 ${profile.kaist_bs_year}`);
  }

  // Include Master's year if available (skipped for integrated MS/PhD students)
  if (profile.kaist_ms_year) {
    parts.push(`석사 ${profile.kaist_ms_year}`);
  }

  // Include PhD year if available
  if (profile.kaist_phd_year) {
    parts.push(`박사 ${profile.kaist_phd_year}`);
  }

  // Join parts with a middle dot separator
  return parts.join(" · ");
}

// ─── Pending Member Card ──────────────────────────────────────────────────────

interface PendingCardProps {
  profile: Profile;
}

/**
 * Card displayed in the "승인 대기" tab for a single pending applicant.
 * Shows name, contact info, education summary, company, and approve/reject buttons.
 */
function PendingCard({ profile }: PendingCardProps) {
  const educationSummary = buildEducationSummary(profile);

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Header row: full name + pending badge */}
      <div className="mb-3 flex items-center gap-2">
        <span className="font-semibold">{profile.full_name}</span>
        <Badge className={getRoleBadgeClass("pending")}>
          {getRoleLabel("pending")}
        </Badge>
      </div>

      {/* Contact info */}
      <div className="mb-1 text-sm text-muted-foreground">
        연락처: {profile.phone}
      </div>

      {/* KAIST education summary — only shown if at least one degree year exists */}
      {educationSummary && (
        <div className="mb-1 text-sm text-muted-foreground">
          KAIST: {educationSummary}
        </div>
      )}

      {/* Company and job title — only shown when both fields are present */}
      {profile.company && profile.job_title && (
        <div className="mb-3 text-sm text-muted-foreground">
          직장: {profile.company} · {profile.job_title}
        </div>
      )}

      {/* Action buttons — Phase 3 TODO: call Supabase RPC to update role */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            // Phase 3 TODO: replace console.log with Supabase role update (pending → member)
            console.log("approve", profile.id);
          }}
        >
          승인
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Phase 3 TODO: replace console.log with Supabase role update or deletion
            console.log("reject", profile.id);
          }}
        >
          반려
        </Button>
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  profile: Profile;
}

/**
 * Card displayed in the "전체 회원" tab for a single approved member.
 * Shows avatar, display name, role badge, join date, and optional promote button.
 */
function MemberCard({ profile }: MemberCardProps) {
  // Format the creation date in Korean locale (e.g. "2024. 2. 1.")
  const joinDate = new Date(profile.created_at).toLocaleDateString("ko-KR");

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {/* Top row: avatar + display name + role badge */}
      <div className="mb-3 flex items-center gap-3">
        <UserAvatar displayName={profile.display_name} size="sm" />
        <div className="flex items-center gap-2">
          <span className="font-semibold">{profile.display_name}</span>
          <Badge className={getRoleBadgeClass(profile.role)}>
            {getRoleLabel(profile.role)}
          </Badge>
        </div>
      </div>

      {/* Join date */}
      <div className="mb-3 text-sm text-muted-foreground">
        가입일: {joinDate}
      </div>

      {/* Promote to admin button — only visible for regular members, not admins */}
      {profile.role === "member" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Phase 3 TODO: replace console.log with Supabase role update (member → admin)
            console.log("promote", profile.id);
          }}
        >
          관리자 승격
        </Button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MemberManagementPage() {
  // Track which tab is currently active: pending approvals or all members
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  // Split ALL_PROFILES into two groups based on role
  // Pending users are waiting for admin approval
  const pendingMembers = ALL_PROFILES.filter((p) => p.role === "pending");
  // Active members are everyone who is not in pending state (includes admin)
  const allMembers = ALL_PROFILES.filter((p) => p.role !== "pending");

  return (
    <div className="relative min-h-full">
      {/* Page title */}
      <h1 className="px-4 pt-4 text-2xl font-bold">회원 관리</h1>

      {/* Tab toggle — switches between pending approvals and all members */}
      {/* role="tablist" wraps the tab group for accessibility */}
      <div role="tablist" className="mt-4 flex border-b">
        {/* Pending approvals tab — shows count of pending users */}
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

        {/* All members tab — shows count of approved + admin users */}
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
          // Pending approvals tab content
          pendingMembers.length > 0 ? (
            pendingMembers.map((profile) => (
              <PendingCard key={profile.id} profile={profile} />
            ))
          ) : (
            <EmptyState icon={Users} title="승인 대기 중인 회원이 없습니다" />
          )
        ) : // All members tab content
        allMembers.length > 0 ? (
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
