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
import DOMPurify from "dompurify";
import { Calendar, Clock, Link2, MapPin, Minus, Plus } from "lucide-react";
import { submitRsvp } from "@/actions/rsvp";
import { reportPayment } from "@/actions/payment";
import { PageHeader } from "@/components/page-header";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Event } from "@/lib/types/event";
import type { Rsvp, RsvpStatus } from "@/lib/types/rsvp";
import type { Payment, PaymentMethod } from "@/lib/types/payment";
import type { AttendeeProfile, RosterAccess } from "@/lib/types/attendee";

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

export function EventDetailClient({
  event,
  initialRsvp,
  initialPayment,
  isAdmin,
  isOrganizer,
  attendeeProfiles,
  rosterAccess,
}: EventDetailClientProps) {
  // RSVP state — initialized from existing RSVP if available
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | undefined>(
    initialRsvp?.status,
  );
  // Guest counts — initialized from existing RSVP if available.
  // Only initialize if the event collects that companion type.
  const [adultGuests, setAdultGuests] = useState(
    event.collect_adult_guests ? (initialRsvp?.adult_guests ?? 0) : 0,
  );
  // Child guests split into two types: those who need a meal and those who don't
  const [childGuestsWithMeal, setChildGuestsWithMeal] = useState(
    event.collect_child_guests_with_meal
      ? (initialRsvp?.child_guests_with_meal ?? 0)
      : 0,
  );
  const [childGuestsNoMeal, setChildGuestsNoMeal] = useState(
    event.collect_child_guests_no_meal
      ? (initialRsvp?.child_guests_no_meal ?? 0)
      : 0,
  );
  // Optional private message to organizers — initialized from existing RSVP
  const [messageToOrganizer, setMessageToOrganizer] = useState(
    initialRsvp?.message_to_organizer ?? "",
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
  // Current user's payment record — initialized from server-resolved data, updated after submission
  const [payment, setPayment] = useState<Payment | undefined>(initialPayment);
  // Tracks whether a payment report submission is in progress (disables button to prevent double-submit)
  const [isPaymentSubmitting, setIsPaymentSubmitting] = useState(false);
  // Holds the error message returned by reportPayment, if any (null when no error)
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
      // Only send companion counts for types this event collects; server also enforces this
      adult_guests: event.collect_adult_guests ? adultGuests : 0,
      // Legacy field — kept for backward compatibility; server sets this to the sum of both types
      child_guests: 0,
      child_guests_with_meal: event.collect_child_guests_with_meal
        ? childGuestsWithMeal
        : 0,
      child_guests_no_meal: event.collect_child_guests_no_meal
        ? childGuestsNoMeal
        : 0,
      // Include the optional message to organizers (empty string → undefined → null in DB)
      message_to_organizer: messageToOrganizer || undefined,
    });

    setIsSubmitting(false);

    if (result.error) {
      // Display the server-side error message to the user
      setRsvpError(result.error);
    }
  };

  /**
   * Submits a payment report for the current event using the selected payment method.
   *
   * Calls the reportPayment Server Action with the currently selected method.
   * On success: updates the local payment state to reflect pending status and closes the Sheet.
   * On failure: displays the error message returned by the server action.
   */
  const handlePaymentReport = async () => {
    // Guard: do not submit if already submitting
    if (isPaymentSubmitting) return;

    setIsPaymentSubmitting(true);
    setPaymentError(null);

    const result = await reportPayment(event.id, {
      method: selectedPaymentMethod as PaymentMethod,
      note: undefined,
    });

    setIsPaymentSubmitting(false);

    if (result.error) {
      // Display the server-side error message inside the Sheet
      setPaymentError(result.error);
      return;
    }

    // On success: optimistically update local payment state to 'pending'
    // so the UI reflects the submission immediately without waiting for a page reload.
    // The server has already revalidated the path, so a full reload would also work.
    setPayment({
      id: "",
      event_id: event.id,
      user_id: "",
      rsvp_id: "",
      amount: totalFee,
      method: selectedPaymentMethod as PaymentMethod,
      status: "pending",
      note: null,
      confirmed_by: null,
      confirmed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setPaymentSheetOpen(false);
  };

  // Check if RSVP deadline has passed (if no deadline, RSVP is always open)
  const isDeadlinePassed = event.rsvp_deadline
    ? new Date() > new Date(event.rsvp_deadline)
    : false;

  // Calculate total fee based on current guest counts and event collection settings.
  // Only add companion fees for types that this event is configured to collect.
  const totalFee =
    event.fee_amount +
    (event.collect_adult_guests ? adultGuests * event.adult_guest_fee : 0) +
    (event.collect_child_guests_with_meal
      ? childGuestsWithMeal * event.child_guest_fee
      : 0) +
    (event.collect_child_guests_no_meal
      ? childGuestsNoMeal * event.child_guest_no_meal_fee
      : 0);

  // Only members who responded 'going' are required to pay the fee
  const canPay = rsvpStatus === "going";

  // Current payment status — read from the reactive payment state (updated after server action calls)
  const paymentStatus = payment?.status;

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

          {/* Long-form description — rendered as sanitized HTML (supports rich text, links, images) */}
          {event.description && (
            <div
              className="prose prose-sm max-w-none text-sm"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(event.description),
              }}
            />
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
                  {/* Adult guest counter — only shown if event collects this type */}
                  {event.collect_adult_guests && (
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
                  )}

                  {/* Child guest counter (with meal) — only shown if event collects this type */}
                  {event.collect_child_guests_with_meal && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">동반 아동 (식사 필요)</span>
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() =>
                            setChildGuestsWithMeal((n) => Math.max(0, n - 1))
                          }
                          disabled={childGuestsWithMeal === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-sm">
                          {childGuestsWithMeal}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setChildGuestsWithMeal((n) => n + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Child guest counter (no meal) — only shown if event collects this type */}
                  {event.collect_child_guests_no_meal && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">동반 아동 (식사 불필요)</span>
                      <div className="flex items-center gap-3">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() =>
                            setChildGuestsNoMeal((n) => Math.max(0, n - 1))
                          }
                          disabled={childGuestsNoMeal === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-6 text-center text-sm">
                          {childGuestsNoMeal}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => setChildGuestsNoMeal((n) => n + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Message to organizers — optional textarea shown for all RSVP statuses.
                  The message is private and only visible to admins and event organizers. */}
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">
                  운영진에게 하고싶은 말 (선택)
                </label>
                <Textarea
                  placeholder="운영진에게 전달할 내용을 입력해주세요 (선택사항)"
                  value={messageToOrganizer}
                  onChange={(e) => setMessageToOrganizer(e.target.value)}
                  className="resize-none"
                  rows={3}
                  maxLength={500}
                />
                {messageToOrganizer.length > 0 && (
                  <p className="text-right text-xs text-muted-foreground">
                    {messageToOrganizer.length}/500
                  </p>
                )}
              </div>

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
            {/* Adult guest fee row — only shown if event collects adult guests */}
            {event.collect_adult_guests && adultGuests > 0 && (
              <div className="flex justify-between">
                <span>성인 동반 {adultGuests}명</span>
                <span>${adultGuests * event.adult_guest_fee}</span>
              </div>
            )}
            {/* Child guest (with meal) fee row */}
            {event.collect_child_guests_with_meal &&
              childGuestsWithMeal > 0 && (
                <div className="flex justify-between">
                  <span>식사 필요 아동 {childGuestsWithMeal}명</span>
                  <span>
                    {event.child_guest_fee > 0
                      ? `$${childGuestsWithMeal * event.child_guest_fee}`
                      : "무료"}
                  </span>
                </div>
              )}
            {/* Child guest (no meal) fee row */}
            {event.collect_child_guests_no_meal && childGuestsNoMeal > 0 && (
              <div className="flex justify-between">
                <span>식사 불필요 아동 {childGuestsNoMeal}명</span>
                <span>
                  {event.child_guest_no_meal_fee > 0
                    ? `$${childGuestsNoMeal * event.child_guest_no_meal_fee}`
                    : "무료"}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>합계</span>
              <span>${totalFee}</span>
            </div>
          </div>

          {/* Payment instructions — rendered as sanitized HTML so links are clickable */}
          {event.payment_instructions && (
            <div
              className="prose prose-sm max-w-none text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(event.payment_instructions),
              }}
            />
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

        {/* === Payment Method Sheet === */}
        {/* Slides up from the bottom for mobile-friendly payment method selection */}
        <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>납부 방법 선택</SheetTitle>
            </SheetHeader>

            {/* Payment method toggle buttons — one per supported transfer service.
                Note: 'other' is used internally (matches PaymentMethod type),
                but displayed as '기타' to Korean-speaking users. */}
            <div className="my-4 grid grid-cols-2 gap-2">
              {(
                [
                  { value: "venmo", label: "Venmo" },
                  { value: "zelle", label: "Zelle" },
                  { value: "paypal", label: "PayPal" },
                  { value: "other", label: "기타" },
                ] as const
              ).map(({ value, label }) => (
                <Button
                  key={value}
                  variant={
                    selectedPaymentMethod === value ? "default" : "outline"
                  }
                  onClick={() => setSelectedPaymentMethod(value)}
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Error message from the server action (e.g. no going RSVP, duplicate payment) */}
            {paymentError && (
              <p className="mb-2 text-sm text-destructive">{paymentError}</p>
            )}

            <SheetFooter>
              <Button
                className="w-full"
                onClick={handlePaymentReport}
                disabled={isPaymentSubmitting}
              >
                {isPaymentSubmitting ? "신고 중..." : "납부 완료 신고"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
