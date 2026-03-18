"use client";

/**
 * Event detail interactive Client Component.
 * Handles RSVP state, guest count input, and payment sheet.
 *
 * Receives pre-resolved event data from the Server Component (page.tsx).
 * Phase 2: Uses dummy data. Phase 3: Will call Server Actions.
 */

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Link2, MapPin, Minus, Plus } from "lucide-react";
import { submitRsvp } from "@/actions/rsvp";
import { PageHeader } from "@/components/page-header";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Event } from "@/lib/types/event";
import type { Rsvp, RsvpStatus } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";

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
}

export function EventDetailClient({
  event,
  initialRsvp,
  initialPayment,
  isAdmin,
  isOrganizer,
}: EventDetailClientProps) {
  // RSVP state — initialized from existing RSVP if available
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | undefined>(
    initialRsvp?.status,
  );
  // Guest counts — initialized from existing RSVP if available
  const [adultGuests, setAdultGuests] = useState(
    initialRsvp?.adult_guests ?? 0,
  );
  const [childGuests, setChildGuests] = useState(
    initialRsvp?.child_guests ?? 0,
  );
  // Controls the payment method selection Sheet
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  // Tracks which payment method the user has selected in the Sheet (default: venmo)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<string>("venmo");
  // Tracks whether the share link was just copied to clipboard
  const [copied, setCopied] = useState(false);
  // Tracks whether an RSVP save is in progress (disables the button to prevent double-submit)
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Holds the error message returned by submitRsvp, if any (null when no error)
  const [rsvpError, setRsvpError] = useState<string | null>(null);

  // Format start date/time in Korean locale (e.g. "4월 15일 오후 03:00")
  const formattedStartDate = new Date(event.start_at).toLocaleDateString(
    "ko-KR",
    {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  // Format end time only (e.g. "오후 06:00") — null if event has no end_at
  const formattedEndDate = event.end_at
    ? new Date(event.end_at).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Format RSVP deadline in Korean locale — null if event has no deadline
  const formattedDeadline = event.rsvp_deadline
    ? new Date(event.rsvp_deadline).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Copy the current page URL to the clipboard and briefly show a confirmation
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    // Reset button label back to default after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Submits the current RSVP selection to the server.
   *
   * Calls the submitRsvp Server Action with the current rsvpStatus, adultGuests,
   * and childGuests values. Shows an error message if the action fails (e.g.,
   * deadline passed or event at capacity).
   */
  const handleRsvpSave = async () => {
    // Guard: do not submit if no status selected or already submitting
    if (!rsvpStatus || isSubmitting) return;

    setIsSubmitting(true);
    setRsvpError(null);

    const result = await submitRsvp(event.id, {
      status: rsvpStatus,
      adult_guests: adultGuests,
      child_guests: childGuests,
    });

    setIsSubmitting(false);

    if (result.error) {
      // Display the server-side error message to the user
      setRsvpError(result.error);
    }
  };

  // Check if RSVP deadline has passed (if no deadline, RSVP is always open)
  const isDeadlinePassed = event.rsvp_deadline
    ? new Date() > new Date(event.rsvp_deadline)
    : false;

  // Calculate total fee based on current guest counts.
  // fee_amount = base member fee, adult_guest_fee = per adult guest,
  // child_guest_fee = per child (always 0 — children attend for free)
  const totalFee =
    event.fee_amount +
    adultGuests * event.adult_guest_fee +
    childGuests * event.child_guest_fee;

  // Only members who responded 'going' are required to pay the fee
  const canPay = rsvpStatus === "going";

  // Current payment status from the initial server-resolved data (undefined if no payment yet)
  const paymentStatus = initialPayment?.status;

  return (
    <div className="pb-20">
      {/* Back button + page title */}
      <PageHeader title={event.title} backHref="/events" />

      <div className="space-y-4 p-4">
        {/* === Event Info Section === */}
        <section className="space-y-3">
          {/* Published / draft / cancelled status pill */}
          <EventStatusBadge status={event.status} />

          {/* Start date and time */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{formattedStartDate}</span>
          </div>

          {/* End time — only rendered when the event has an end_at value */}
          {event.end_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 shrink-0" />
              <span>종료: {formattedEndDate}</span>
            </div>
          )}

          {/* Physical location of the event */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{event.location}</span>
          </div>

          {/* Long-form description — preserves line breaks entered by the organizer */}
          {event.description && (
            <p className="whitespace-pre-wrap text-sm">{event.description}</p>
          )}

          {/* RSVP deadline — only rendered when the event has a deadline */}
          {event.rsvp_deadline && (
            <p className="text-sm text-muted-foreground">
              RSVP 마감: {formattedDeadline}
            </p>
          )}
        </section>

        {/* Copy current page URL to clipboard */}
        <Button variant="outline" className="w-full" onClick={handleCopyLink}>
          <Link2 className="mr-2 h-4 w-4" />
          {copied ? "복사됨!" : "이벤트 링크 복사"}
        </Button>

        {/* Admin/organizer actions — visible to admins and event organizers */}
        {(isAdmin || isOrganizer) && (
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/events/${event.id}/edit`}>이벤트 수정</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/events/${event.id}/manage`}>
                참석자 & 회비 관리
              </Link>
            </Button>
          </div>
        )}

        {/* === RSVP Section === */}
        <section className="space-y-3 rounded-lg border p-4">
          {/* Section header with current status badge */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">참석 여부</h2>
            <RsvpStatusBadge status={rsvpStatus} />
          </div>

          {isDeadlinePassed ? (
            // Show message when deadline has passed
            <p className="text-sm text-muted-foreground">
              참석 응답 마감일이 지났습니다.
            </p>
          ) : (
            <>
              {/* RSVP choice buttons */}
              <div className="flex gap-2">
                {(
                  [
                    { value: "going", label: "참석" },
                    { value: "maybe", label: "미정" },
                    { value: "not_going", label: "불참" },
                  ] as const
                ).map(({ value, label }) => (
                  <Button
                    key={value}
                    variant={rsvpStatus === value ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setRsvpStatus(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              {/* Guest count inputs — only shown when going */}
              {rsvpStatus === "going" && (
                <div className="space-y-2">
                  {/* Adult guest counter */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">성인 동반자</span>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() =>
                          setAdultGuests((n) => Math.max(0, n - 1))
                        }
                        disabled={adultGuests === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center text-sm">
                        {adultGuests}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setAdultGuests((n) => n + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Child guest counter */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm">아동 동반자</span>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() =>
                          setChildGuests((n) => Math.max(0, n - 1))
                        }
                        disabled={childGuests === 0}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-6 text-center text-sm">
                        {childGuests}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        onClick={() => setChildGuests((n) => n + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Error message returned by submitRsvp (e.g. deadline passed, full capacity) */}
              {rsvpError && (
                <p className="text-sm text-destructive">{rsvpError}</p>
              )}

              {/* Save RSVP button — disabled while a submission is in progress */}
              <Button
                className="w-full"
                onClick={handleRsvpSave}
                disabled={isSubmitting || !rsvpStatus}
              >
                {isSubmitting ? "저장 중..." : "RSVP 저장"}
              </Button>
            </>
          )}
        </section>

        {/* === Payment Section === */}
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">회비</h2>

          {/* Fee breakdown — shows base fee, per-guest fees, and total */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>본인</span>
              <span>${event.fee_amount}</span>
            </div>
            {adultGuests > 0 && (
              <div className="flex justify-between">
                <span>성인 동반 {adultGuests}명</span>
                <span>${adultGuests * event.adult_guest_fee}</span>
              </div>
            )}
            {childGuests > 0 && (
              <div className="flex justify-between">
                <span>아동 동반 {childGuests}명</span>
                <span>무료</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>합계</span>
              <span>${totalFee}</span>
            </div>
          </div>

          {/* Payment instructions provided by the organizer — may be null */}
          {event.payment_instructions && (
            <p className="text-sm text-muted-foreground">
              {event.payment_instructions}
            </p>
          )}

          {/* Payment UI — only rendered for members with rsvpStatus === 'going' */}
          {!canPay ? (
            <p className="text-sm text-muted-foreground">
              참석(going)으로 응답한 경우에만 납부할 수 있습니다.
            </p>
          ) : (
            <div className="space-y-2">
              {/* confirmed: payment is fully approved — no action needed */}
              {paymentStatus === "confirmed" && (
                <div className="flex items-center gap-2">
                  <PaymentStatusBadge status="confirmed" />
                  <span className="text-sm">납부가 완료되었습니다.</span>
                </div>
              )}

              {/* pending: payment was submitted and is awaiting organizer review */}
              {paymentStatus === "pending" && (
                <div className="flex items-center gap-2">
                  <PaymentStatusBadge status="pending" />
                  <span className="text-sm">납부 확인 중입니다.</span>
                </div>
              )}

              {/* rejected: organizer declined the payment — member can try again */}
              {paymentStatus === "rejected" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <PaymentStatusBadge status="rejected" />
                    <span className="text-sm">납부가 반려되었습니다.</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setPaymentSheetOpen(true)}
                  >
                    다시 납부하기
                  </Button>
                </div>
              )}

              {/* no payment record yet: show the initial pay button */}
              {!paymentStatus && (
                <Button
                  className="w-full"
                  onClick={() => setPaymentSheetOpen(true)}
                >
                  납부했어요
                </Button>
              )}
            </div>
          )}
        </section>

        {/* === Payment Method Sheet === */}
        {/* Slides up from the bottom for mobile-friendly payment method selection */}
        <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>납부 방법 선택</SheetTitle>
            </SheetHeader>

            {/* Payment method toggle buttons — one per supported transfer service */}
            <div className="my-4 grid grid-cols-2 gap-2">
              {(["venmo", "zelle", "paypal", "기타"] as const).map((method) => (
                <Button
                  key={method}
                  variant={
                    selectedPaymentMethod === method ? "default" : "outline"
                  }
                  onClick={() => setSelectedPaymentMethod(method)}
                  className="capitalize"
                >
                  {method === "기타"
                    ? "기타"
                    : method.charAt(0).toUpperCase() + method.slice(1)}
                </Button>
              ))}
            </div>

            <SheetFooter>
              {/* Phase 3 TODO: call reportPayment server action instead of console.log */}
              <Button
                className="w-full"
                onClick={() => {
                  console.log(
                    "Payment reported:",
                    selectedPaymentMethod,
                    "amount:",
                    totalFee,
                  );
                  setPaymentSheetOpen(false);
                }}
              >
                납부 완료 신고
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
