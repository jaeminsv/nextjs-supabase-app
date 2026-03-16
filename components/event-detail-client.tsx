"use client";

/**
 * Event detail interactive Client Component.
 * Handles RSVP state, guest count input, and payment sheet.
 *
 * Receives pre-resolved event data from the Server Component (page.tsx).
 * Phase 2: Uses dummy data. Phase 3: Will call Server Actions.
 *
 * NOTE: State variables are declared here as scaffolding for Task 006-3/006-4.
 * They are intentionally unused until those tasks wire up the UI sections.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState } from "react";
import Link from "next/link";
import { Calendar, Clock, Link2, MapPin, Minus, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EventStatusBadge } from "@/components/event-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { Button } from "@/components/ui/button";
import { CURRENT_USER } from "@/lib/dummy-data";
import type { Event } from "@/lib/types/event";
import type { Rsvp, RsvpStatus } from "@/lib/types/rsvp";
import type { Payment } from "@/lib/types/payment";

interface EventDetailClientProps {
  event: Event;
  // Current user's RSVP for this event (undefined if not yet responded)
  initialRsvp?: Rsvp;
  // Current user's payment record for this event (undefined if not yet paid)
  initialPayment?: Payment;
}

export function EventDetailClient({
  event,
  initialRsvp,
  initialPayment,
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
  // Tracks whether the share link was just copied to clipboard
  const [copied, setCopied] = useState(false);

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

  // Check if RSVP deadline has passed (if no deadline, RSVP is always open)
  const isDeadlinePassed = event.rsvp_deadline
    ? new Date() > new Date(event.rsvp_deadline)
    : false;

  // Phase 2: CURRENT_USER is always a 'member', so admin actions never render.
  // Phase 3 TODO: also show for event organizers (not just global admins).
  const isAdmin = CURRENT_USER.role === "admin";

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

        {/* Admin/organizer actions — hidden in Phase 2 because CURRENT_USER.role === 'member' */}
        {/* Phase 3 TODO: also show for event organizers */}
        {isAdmin && (
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

              {/* Save RSVP button */}
              {/* Phase 3 TODO: call submitRsvp server action instead of console.log */}
              <Button
                className="w-full"
                onClick={() =>
                  console.log(
                    "RSVP save:",
                    rsvpStatus,
                    adultGuests,
                    childGuests,
                  )
                }
              >
                RSVP 저장
              </Button>
            </>
          )}
        </section>

        {/* TODO 006-4: Payment section */}
      </div>
    </div>
  );
}
