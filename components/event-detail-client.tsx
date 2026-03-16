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

  return (
    <div className="pb-20">
      {/* TODO 006-2: PageHeader + EventInfo section + copy link + admin actions */}
      {/* TODO 006-3: RSVP section */}
      {/* TODO 006-4: Payment section + payment Sheet */}
    </div>
  );
}
