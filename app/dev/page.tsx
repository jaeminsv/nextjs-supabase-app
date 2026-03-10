/**
 * DEV-ONLY: Component Showcase Page
 *
 * ⚠️  IMPORTANT: This page is for development visualization only.
 *     It must be DELETED before Phase 3 (Task 010) begins.
 *     See ROADMAP.md - "Task DEV: /dev 쇼케이스 페이지 제거"
 *
 * Accessible at: http://localhost:3000/dev (no auth required)
 * Displays all shared UI components with dummy data for visual verification.
 */

import { CalendarX } from "lucide-react";

import { EventCard } from "@/components/event-card";
import { EmptyState } from "@/components/empty-state";
import { EventStatusBadge } from "@/components/event-status-badge";
import { PageHeader } from "@/components/page-header";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { RsvpStatusBadge } from "@/components/rsvp-status-badge";
import { UserAvatar } from "@/components/user-avatar";
import {
  ALL_PROFILES,
  CURRENT_USER,
  DUMMY_EVENTS,
  getDummyRsvp,
} from "@/lib/dummy-data";

// ---------- Section wrapper ----------
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 border-b pb-2 text-lg font-bold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------- Row wrapper ----------
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}

export default function DevShowcasePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Page header using the actual PageHeader component */}
      <PageHeader title="컴포넌트 쇼케이스 (DEV)" />

      <main className="space-y-2 p-4">
        {/* Warning banner */}
        <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
          ⚠️ 개발용 페이지입니다. Phase 3 시작 전에 삭제해야 합니다. (ROADMAP.md
          Task DEV 참고)
        </div>

        {/* ── 1. RsvpStatusBadge ── */}
        <Section title="1. RsvpStatusBadge">
          <Row>
            <RsvpStatusBadge status="going" />
            <RsvpStatusBadge status="maybe" />
            <RsvpStatusBadge status="not_going" />
            <RsvpStatusBadge status={null} />
            <RsvpStatusBadge status={undefined} />
          </Row>
          <p className="mt-2 text-xs text-muted-foreground">
            going · maybe · not_going · null(미응답) · undefined(미응답)
          </p>
        </Section>

        {/* ── 2. PaymentStatusBadge ── */}
        <Section title="2. PaymentStatusBadge">
          <Row>
            <PaymentStatusBadge status="pending" />
            <PaymentStatusBadge status="confirmed" />
            <PaymentStatusBadge status="rejected" />
          </Row>
          <p className="mt-2 text-xs text-muted-foreground">
            pending(확인 대기) · confirmed(납부 완료) · rejected(반려)
          </p>
        </Section>

        {/* ── 3. EventStatusBadge ── */}
        <Section title="3. EventStatusBadge">
          <Row>
            <EventStatusBadge status="draft" />
            <EventStatusBadge status="published" />
            <EventStatusBadge status="cancelled" />
            <EventStatusBadge status="completed" />
          </Row>
          <p className="mt-2 text-xs text-muted-foreground">
            draft(초안) · published(모집중) · cancelled(취소됨) ·
            completed(완료)
          </p>
        </Section>

        {/* ── 4. UserAvatar ── */}
        <Section title="4. UserAvatar">
          <Row>
            {ALL_PROFILES.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col items-center gap-1"
              >
                <UserAvatar
                  displayName={profile.display_name}
                  avatarUrl={null}
                  size="lg"
                />
                <span className="text-xs text-muted-foreground">
                  {profile.display_name}
                </span>
              </div>
            ))}
          </Row>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">
              Size variants (CURRENT_USER)
            </p>
            <Row>
              <div className="flex flex-col items-center gap-1">
                <UserAvatar displayName={CURRENT_USER.display_name} size="sm" />
                <span className="text-xs text-muted-foreground">sm</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <UserAvatar displayName={CURRENT_USER.display_name} size="md" />
                <span className="text-xs text-muted-foreground">md</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <UserAvatar displayName={CURRENT_USER.display_name} size="lg" />
                <span className="text-xs text-muted-foreground">lg</span>
              </div>
            </Row>
          </div>
        </Section>

        {/* ── 5. EventCard ── */}
        <Section title="5. EventCard (더미 이벤트 5개)">
          <div className="space-y-3">
            {DUMMY_EVENTS.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                userRsvpStatus={
                  getDummyRsvp(event.id, CURRENT_USER.id)?.status ?? null
                }
                rsvpCount={
                  // Count "going" RSVPs for this event from dummy data
                  event.id === "event-1" ? 3 : event.id === "event-2" ? 1 : 0
                }
              />
            ))}
          </div>
        </Section>

        {/* ── 6. EmptyState ── */}
        <Section title="6. EmptyState">
          <div className="rounded-lg border">
            <EmptyState
              icon={CalendarX}
              title="이벤트가 없습니다"
              description="아직 예정된 이벤트가 없어요. 새 이벤트를 만들어보세요."
            />
          </div>
        </Section>
      </main>
    </div>
  );
}
