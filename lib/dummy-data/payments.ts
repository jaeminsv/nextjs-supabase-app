import type { Payment } from "@/lib/types/payment";

// Sample payments for event-1 (봄 소풍)
// Covers all three payment statuses: pending, confirmed, rejected
export const DUMMY_PAYMENTS: Payment[] = [
  // Confirmed payment — member-2 paid and organizer confirmed
  {
    id: "payment-1-member2",
    event_id: "event-1",
    user_id: "profile-member-2",
    rsvp_id: "rsvp-1-member2",
    amount: 30,
    method: "venmo",
    status: "confirmed",
    note: null,
    confirmed_by: "profile-admin",
    confirmed_at: "2026-03-15T10:00:00Z",
    created_at: "2026-03-14T09:00:00Z",
    updated_at: "2026-03-15T10:00:00Z",
  },
  // Pending payment — member-1 reported payment, waiting for confirmation
  // member-1 brought 1 adult + 2 children: 30 (self) + 30 (adult guest) = $60
  {
    id: "payment-1-member1",
    event_id: "event-1",
    user_id: "profile-member-1",
    rsvp_id: "rsvp-1-member1",
    amount: 60,
    method: "zelle",
    status: "pending",
    note: "배우자 포함 송금했습니다",
    confirmed_by: null,
    confirmed_at: null,
    created_at: "2026-03-13T14:00:00Z",
    updated_at: "2026-03-13T14:00:00Z",
  },
  // Rejected payment — admin's payment was rejected (wrong amount), resubmission needed
  {
    id: "payment-1-admin",
    event_id: "event-1",
    user_id: "profile-admin",
    rsvp_id: "rsvp-1-admin",
    amount: 20,
    method: "venmo",
    status: "rejected",
    note: "금액이 잘못 입력되었습니다. 다시 신고해주세요.",
    confirmed_by: "profile-admin",
    confirmed_at: "2026-03-12T11:00:00Z",
    created_at: "2026-03-11T10:00:00Z",
    updated_at: "2026-03-12T11:00:00Z",
  },
];

// Helper: get payment for a specific user and event
export function getDummyPayment(
  eventId: string,
  userId: string,
): Payment | undefined {
  return DUMMY_PAYMENTS.find(
    (p) => p.event_id === eventId && p.user_id === userId,
  );
}
