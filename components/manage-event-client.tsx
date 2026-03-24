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
import { confirmPayment, rejectPayment } from "@/actions/payment";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { EmptyState } from "@/components/empty-state";
import type { Event, EventOrganizer } from "@/lib/types/event";
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
  // Whether the current user is an admin — controls visibility of the organizer section
  isAdmin: boolean;
  // Current list of organizers for this event (read-only display in manage page)
  organizers: EventOrganizer[];
}

export function ManageEventClient({
  event,
  attendees,
  isAdmin,
  organizers,
}: ManageEventClientProps) {
  // Controls which payment-status filter tab is active
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  // Tracks the payment ID currently being processed (null = no action in progress).
  // Disables all confirm/reject buttons while one request is pending to prevent double-submit.
  const [loadingPaymentId, setLoadingPaymentId] = useState<string | null>(null);
  // Prevents duplicate PDF downloads when the button is clicked rapidly
  const [isDownloading, setIsDownloading] = useState(false);

  /**
   * Generates and downloads a PDF of all attendees for this event.
   * Uses dynamic import so jsPDF is not included in the initial page bundle.
   * Only available to admins (isAdmin gate is applied in the JSX).
   */
  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const { generateAttendeeListPdf } = await import("@/lib/utils/pdf");
      await generateAttendeeListPdf(attendees, event.title);
    } finally {
      setIsDownloading(false);
    }
  };

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

  // Total adult count = members (goingCount) + all adult companions
  const totalAdultCount =
    goingCount + attendees.reduce((sum, a) => sum + a.rsvp.adult_guests, 0);
  // Total child count = sum of all child guests
  const totalChildCount = attendees.reduce(
    (sum, a) => sum + a.rsvp.child_guests,
    0,
  );
  // Grand total = adults + children
  const totalPeopleCount = totalAdultCount + totalChildCount;

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

  /**
   * Confirms a member's pending payment.
   * Sets the payment status to 'confirmed' via the confirmPayment Server Action.
   * The server revalidates the manage page, so the list refreshes automatically.
   *
   * @param paymentId - UUID of the payment to confirm
   */
  const handleConfirm = async (paymentId: string) => {
    setLoadingPaymentId(paymentId);
    const result = await confirmPayment(paymentId, event.id);
    setLoadingPaymentId(null);

    if (result.error) {
      console.error("confirmPayment error:", result.error);
    }
  };

  /**
   * Rejects a member's pending payment.
   * Sets the payment status to 'rejected' via the rejectPayment Server Action.
   * The server revalidates the manage page, so the list refreshes automatically.
   * After rejection, the member can re-submit a new payment.
   *
   * @param paymentId - UUID of the payment to reject
   */
  const handleReject = async (paymentId: string) => {
    setLoadingPaymentId(paymentId);
    const result = await rejectPayment(paymentId, event.id);
    setLoadingPaymentId(null);

    if (result.error) {
      console.error("rejectPayment error:", result.error);
    }
  };

  // Tab definitions for rendering the tab bar
  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "전체" },
    { value: "pending", label: "확인 대기" },
    { value: "confirmed", label: "납부 완료" },
    { value: "unpaid", label: "미납부" },
  ];

  return (
    <div className="pb-20">
      {/* ─── Summary Stats Banner + PDF button (admin only) ───────────────── */}
      <div className="m-4 flex items-center gap-2">
        <div className="flex-1 rounded-lg bg-muted p-3 text-sm font-medium">
          {confirmedCount}/{goingCount}명 납부 완료 &middot; ${collectedAmount}{" "}
          / ${totalAmount} 수금
        </div>
        {/* PDF download button — only shown to admins to avoid data leakage */}
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="shrink-0"
          >
            {isDownloading ? "생성 중..." : "참가자 PDF"}
          </Button>
        )}
      </div>

      {/* ─── Headcount Summary ────────────────────────────────────────────── */}
      {/* Headcount summary — total participants broken down by adult/child */}
      <div className="mx-4 mb-3 rounded-lg bg-muted p-3 text-sm font-medium">
        총 {totalPeopleCount}명 참가 &middot; 성인 {totalAdultCount}명 &middot;
        아동 {totalChildCount}명
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

              {/* KAIST graduation years and company/job title — shown when available */}
              {(() => {
                // Build graduation year string from whichever degrees the member holds
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

                // Combine company and job_title; fall back to whichever is non-null
                const companyInfo =
                  profile.company && profile.job_title
                    ? `${profile.company} / ${profile.job_title}`
                    : (profile.company ?? profile.job_title ?? null);

                return kaistInfo || companyInfo ? (
                  <div className="text-xs text-muted-foreground">
                    {kaistInfo && <span>{kaistInfo}</span>}
                    {kaistInfo && companyInfo && (
                      <span className="mx-1">&middot;</span>
                    )}
                    {companyInfo && <span>{companyInfo}</span>}
                  </div>
                ) : null;
              })()}

              {/* Middle row: guest counts + fee amount */}
              {/* total adults = 1 (member) + adult_guests (companions) */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  성인 {rsvp.adult_guests + 1}명 &middot; 아동{" "}
                  {rsvp.child_guests}명
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

              {/* Message to organizers — only visible to admins, shown when the member
                  left a note during RSVP submission. Hidden from non-admin organizers. */}
              {isAdmin && rsvp.message_to_organizer && (
                <div className="rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground">
                  <span className="font-medium">메시지: </span>
                  {rsvp.message_to_organizer}
                </div>
              )}

              {/* Confirm / Reject buttons — only shown for pending payments.
                  Both buttons are disabled while any payment action is in progress
                  to prevent concurrent requests from creating inconsistent state. */}
              {payment?.status === "pending" && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleConfirm(payment.id)}
                    disabled={loadingPaymentId !== null}
                  >
                    {loadingPaymentId === payment.id ? "처리 중..." : "확인"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleReject(payment.id)}
                    disabled={loadingPaymentId !== null}
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

      {/* ─── Organizer List Section (admin only, read-only) ──────────────── */}
      {/* Organizer add/remove is available on the event edit page (/events/[id]/edit) */}
      {isAdmin && (
        <section className="m-4 space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">주최자 목록</h2>
          {organizers.length > 0 ? (
            // Display each organizer's display name and full name in a simple list
            <ul className="space-y-1">
              {organizers.map((organizer) => (
                <li key={organizer.user_id} className="text-sm">
                  <span className="font-medium">
                    {organizer.profile.display_name}
                  </span>
                  <span className="ml-1 text-muted-foreground">
                    ({organizer.profile.full_name})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              등록된 주최자가 없습니다.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            주최자를 추가하거나 제거하려면 이벤트 수정 페이지를 이용하세요.
          </p>
        </section>
      )}
    </div>
  );
}
