"use client";

/**
 * Manage event interactive Client Component.
 * Handles filter tab state, confirm/reject actions, and organizer management.
 *
 * Receives pre-computed AttendeeRow data from the Server Component (page.tsx).
 * Phase 2: Uses dummy data. Phase 3: Will call Server Actions.
 */

import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Event } from "@/lib/types/event";
import type { Rsvp } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";
import type { Profile } from "@/lib/types/profile";

// Re-uses the AttendeeRow shape from page.tsx (locally redefined to avoid import cycles)
export interface AttendeeRow {
  profile: Profile;
  rsvp: Rsvp;
  payment?: Payment; // undefined = no payment submitted yet
  totalFee: number;
}

// Tab values for filtering the attendee list by payment status
type TabValue = "all" | "pending" | "confirmed" | "unpaid";

interface ManageEventClientProps {
  event: Event;
  attendees: AttendeeRow[];
}

export function ManageEventClient({
  event,
  attendees,
}: ManageEventClientProps) {
  // Controls which payment-status filter tab is active
  const [activeTab, setActiveTab] = useState<TabValue>("all");

  // TODO (Task 015): derive isAdmin from the authenticated user's profile role.
  // Organizer management section is hidden until role check is wired up.
  const isAdmin = false;

  // ─── Stats calculation ─────────────────────────────────────────────────────

  // Total number of members who responded 'going'
  const goingCount = attendees.length;

  // Number of members whose payment has been confirmed by an organizer
  const confirmedCount = attendees.filter(
    (a) => a.payment?.status === "confirmed",
  ).length;

  // Total dollar amount collected from confirmed payments
  const collectedAmount = attendees
    .filter((a) => a.payment?.status === "confirmed")
    .reduce((sum, a) => sum + (a.payment?.amount ?? 0), 0);

  // Total expected amount if all going members pay their full fee
  const totalAmount = attendees.reduce((sum, a) => sum + a.totalFee, 0);

  // ─── Tab filter ────────────────────────────────────────────────────────────

  const filteredAttendees =
    activeTab === "all"
      ? attendees
      : activeTab === "pending"
        ? attendees.filter((a) => a.payment?.status === "pending")
        : activeTab === "confirmed"
          ? attendees.filter((a) => a.payment?.status === "confirmed")
          : attendees.filter(
              (a) => !a.payment || a.payment.status === "rejected",
            );

  // Tab definitions for rendering the tab bar
  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "pending", label: "확인 대기" },
    { value: "confirmed", label: "납부 완료" },
    { value: "unpaid", label: "미납부" },
  ];

  return (
    <div className="pb-20">
      {/* ─── Summary Stats Banner ──────────────────────────────────────────── */}
      <div className="m-4 rounded-lg bg-muted p-3 text-sm font-medium">
        {confirmedCount}/{goingCount}명 납부 완료 &middot; ${collectedAmount} /{" "}
        ${totalAmount} 수금
      </div>

      {/* ─── Filter Tabs ──────────────────────────────────────────────────── */}
      {/* role="tablist" wraps the tabs; each button has role="tab" for aria support */}
      <div role="tablist" className="flex border-b">
        {tabs.map(({ value, label }) => (
          <button
            key={value}
            role="tab"
            aria-selected={activeTab === value}
            onClick={() => setActiveTab(value)}
            className={`px-3 py-3 text-sm font-medium ${
              activeTab === value
                ? "border-b-2 border-primary font-semibold"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── Attendee Cards ───────────────────────────────────────────────── */}
      <div className="space-y-3 p-4">
        {filteredAttendees.length > 0 ? (
          filteredAttendees.map(({ profile, rsvp, payment, totalFee }) => (
            <div key={rsvp.id} className="space-y-2 rounded-lg border p-4">
              {/* Top row: display name + payment status badge */}
              <div className="flex items-center justify-between">
                <span className="font-semibold">{profile.display_name}</span>
                <PaymentStatusBadge status={payment?.status} />
              </div>

              {/* Middle row: guest counts + fee amount */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  성인 {rsvp.adult_guests}명 &middot; 아동 {rsvp.child_guests}명
                </span>
                <span>${totalFee}</span>
              </div>

              {/* Bottom row: payment method + RSVP status badge — only when payment exists */}
              {payment && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    납부방법: {payment.method}
                  </span>
                  <RsvpStatusBadge status={rsvp.status} />
                </div>
              )}

              {/* Confirm / Reject buttons — only shown for pending payments */}
              {/* Phase 3 TODO: call confirmPayment / rejectPayment server actions */}
              {payment?.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => console.log("confirm", payment.id)}
                  >
                    확인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => console.log("reject", payment.id)}
                  >
                    반려
                  </Button>
                </div>
              )}
            </div>
          ))
        ) : (
          <EmptyState icon={Users} title="참석자가 없습니다" />
        )}
      </div>

      {/* ─── Organizer Management Section (admin only) ────────────────────── */}
      {/* TODO (Task 015): implement organizer add/remove with real profiles query */}
      {isAdmin && (
        <section className="m-4 space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">주최자 관리</h2>
          <div className="text-sm text-muted-foreground">
            주최자 ID: {event.created_by}
          </div>
        </section>
      )}
    </div>
  );
}
