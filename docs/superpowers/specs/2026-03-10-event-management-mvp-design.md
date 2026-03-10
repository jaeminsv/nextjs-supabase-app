# KAIST Silicon Valley Alumni — Event Management MVP

## Overview

Web MVP for managing KAIST Silicon Valley alumni events. Replaces the current workflow of KakaoTalk group chat + Google Forms + Google Spreadsheet with a centralized, mobile-first web application.

**Tech stack:** Next.js 16 App Router + Supabase + TypeScript + Tailwind CSS + shadcn/ui

## Problem Statement

- Event info gets lost in KakaoTalk chat history (volatile)
- Manual fee tracking via spreadsheet is the biggest time sink
- RSVP management scattered across Google Forms and chat
- No structured carpool coordination (deferred to v1.1)

## MVP Scope (Balanced MVP)

**In scope:**

- Event CRUD + publishing (soft delete only — use `cancelled` status)
- RSVP management (going / maybe / not_going + adult/child guest counts)
- Fee tracking with guest type support (manual "I paid" + organizer confirmation)
- Member management with admin approval (multiple admins supported)
- Flexible role delegation (admin → event-level organizer)
- Mobile-first responsive design

**Out of scope (v1.1+):**

- Carpool matching
- Stripe/payment gateway integration
- Push notifications / email reminders
- Invite link system
- Admin Settings page (defer until concrete needs arise)

## User Roles

| Role                      | Permissions                                                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** (multiple)      | Full access. Approve members, create events, delegate organizer role per event                                                    |
| **Organizer** (per-event) | Manage assigned event: edit, view RSVPs, confirm payments. Determined via `event_organizers` join table, not a profile-level role |
| **Member**                | View events, RSVP, report payment, edit own profile                                                                               |
| **Pending**               | Just signed up, waiting for admin approval. Sees "approval pending" page only                                                     |

## Data Model

### profiles (extends auth.users)

| Column        | Type                       | Required | Notes                                                                                                         |
| ------------- | -------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| id            | uuid (PK, FK → auth.users) | yes      |                                                                                                               |
| full_name     | text                       | yes      |                                                                                                               |
| display_name  | text                       | yes      | nickname                                                                                                      |
| phone         | text                       | yes      |                                                                                                               |
| role          | enum                       | yes      | pending / member / admin                                                                                      |
| payment_info  | text                       | no       | Venmo/Zelle handle                                                                                            |
| bs_year       | text                       | no       | Bachelor class year (e.g. "09")                                                                               |
| bs_major      | text                       | no       | Bachelor major                                                                                                |
| ms_year       | text                       | no       | Master class year                                                                                             |
| ms_major      | text                       | no       | Master major                                                                                                  |
| phd_year      | text                       | no       | PhD class year                                                                                                |
| phd_major     | text                       | no       | PhD major                                                                                                     |
| is_integrated | boolean                    | no       | MS-PhD integrated program. When true, phd_year/phd_major hold integrated program info; ms fields hidden in UI |
| company       | text                       | no       | Current organization                                                                                          |
| job_title     | text                       | no       | Current position                                                                                              |
| created_at    | timestamptz                | yes      |                                                                                                               |
| updated_at    | timestamptz                | yes      |                                                                                                               |

### events

| Column          | Type                 | Required | Notes                                                          |
| --------------- | -------------------- | -------- | -------------------------------------------------------------- |
| id              | uuid (PK)            | yes      |                                                                |
| title           | text                 | yes      |                                                                |
| description     | text                 | no       | rich text / markdown                                           |
| start_at        | timestamptz          | yes      | Event start time                                               |
| end_at          | timestamptz          | no       | Event end time (null = open-ended)                             |
| location        | text                 | yes      |                                                                |
| fee_amount      | numeric              | yes      | Per-person fee. 0 = free event                                 |
| adult_guest_fee | numeric              | yes      | Fee per adult guest. Default = same as fee_amount              |
| child_guest_fee | numeric              | yes      | Fee per child guest. 0 = free for children                     |
| fee_description | text                 | no       | Payment instructions, e.g. "Venmo @kaist-sv"                   |
| max_capacity    | int                  | no       | null = unlimited. Counts total headcount (member + all guests) |
| rsvp_deadline   | timestamptz          | no       | null = can RSVP until event starts                             |
| status          | enum                 | yes      | draft / published / cancelled / completed                      |
| created_by      | uuid (FK → profiles) | yes      |                                                                |
| created_at      | timestamptz          | yes      |                                                                |
| updated_at      | timestamptz          | yes      |                                                                |

**Event status transitions:**

- `draft` → `published` (organizer publishes)
- `published` → `cancelled` (organizer cancels)
- `published` → `completed` (organizer marks as done)
- `cancelled` → `published` (organizer re-opens)
- No hard delete — use `cancelled` status

### event_organizers

| Column      | Type                 | Notes        |
| ----------- | -------------------- | ------------ |
| event_id    | uuid (FK → events)   | composite PK |
| user_id     | uuid (FK → profiles) | composite PK |
| assigned_at | timestamptz          |              |

Note: Organizer is NOT a profile-level role. It is determined per-event via this join table. RLS policies must join this table to check organizer permissions.

### rsvps

| Column            | Type                 | Notes                                                               |
| ----------------- | -------------------- | ------------------------------------------------------------------- |
| id                | uuid (PK)            |                                                                     |
| event_id          | uuid (FK → events)   |                                                                     |
| user_id           | uuid (FK → profiles) | unique constraint on (event_id, user_id)                            |
| status            | enum                 | going / maybe / not_going                                           |
| adult_guest_count | int                  | default 0. Additional adult guests (excludes the member themselves) |
| child_guest_count | int                  | default 0. Additional child guests                                  |
| updated_at        | timestamptz          |                                                                     |

**Guest count semantics:** Counts represent additional people beyond the member. A member with `adult_guest_count=1, child_guest_count=2` means 4 people total (member + 1 adult + 2 children).

**Total headcount formula:** `1 (member) + adult_guest_count + child_guest_count`

**RSVP change policy:** Members can change RSVP anytime before `rsvp_deadline` (or `start_at` if no deadline set). After deadline, RSVP is locked.

### payments

| Column       | Type                 | Notes                                                                                                                  |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| id           | uuid (PK)            |                                                                                                                        |
| event_id     | uuid (FK → events)   |                                                                                                                        |
| user_id      | uuid (FK → profiles) |                                                                                                                        |
| amount       | numeric              | Total amount (auto-calculated: fee_amount + adult_guest_count _ adult_guest_fee + child_guest_count _ child_guest_fee) |
| method       | enum                 | venmo / zelle / paypal / other                                                                                         |
| status       | enum                 | pending / confirmed / rejected                                                                                         |
| confirmed_by | uuid (FK → profiles) | organizer who confirmed                                                                                                |
| created_at   | timestamptz          |                                                                                                                        |
| updated_at   | timestamptz          |                                                                                                                        |

**Re-submission policy:** If a payment is `rejected`, the member can submit a new payment record. No unique constraint on (event_id, user_id) — but only one `pending` or `confirmed` payment allowed per event+user (enforced via application logic).

### Relationships

- profiles 1 ← N events (created_by)
- events 1 ← N event_organizers
- events 1 ← N rsvps
- events 1 ← N payments
- profiles 1 ← N rsvps
- profiles 1 ← N payments

### RLS Policy Matrix

| Table                | SELECT                                                      | INSERT                                                               | UPDATE                                                         | DELETE                       |
| -------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------- |
| **profiles**         | Own profile: self. All profiles: any member/admin           | Self only (on sign-up)                                               | Self only (own profile). Admin can update any profile's `role` | Never                        |
| **events**           | Published: any member. Draft: creator/organizer/admin       | Admin or member (if creating, status must be draft)                  | Creator, event organizer, or admin                             | Never (use cancelled status) |
| **event_organizers** | Event organizer, creator, or admin                          | Admin only                                                           | Never (delete + re-create)                                     | Admin only                   |
| **rsvps**            | Own RSVP: self. All RSVPs for event: organizer/admin        | Self only (must be member, event must be published, within deadline) | Self only (within deadline)                                    | Self only                    |
| **payments**         | Own payments: self. All payments for event: organizer/admin | Self only (must have RSVP with status=going)                         | Status change: organizer/admin only                            | Never                        |

## Screens (~8 total)

### Public

- **Login** — Google OAuth. New users redirected to sign-up form after first login
- **Sign Up** — Multi-step wizard: required info (name, phone) → optional KAIST info → optional company → submit for approval

### Pending Member

- **Approval Pending** — "Your account is awaiting admin approval" message. No access to other features.

### Member (approved)

- **Dashboard** — Upcoming events, my RSVPs at a glance
- **Event List** — All published events. MVP filter: upcoming/past toggle
- **Event Detail** — Full info, RSVP button (with adult/child guest counts), fee status, shareable link
- **My Profile** — Edit personal info, KAIST info, payment info

### Event Organizer

- **Create/Edit Event** — Title, date/time (start + optional end), location, fees (member/adult guest/child guest), capacity, RSVP deadline
- **Attendee & Fee Dashboard** — Combined view: attendee list with RSVP status + payment status. Confirm/reject payments. Summary stats: "25/30 paid, $750/$900 collected"

### Admin

- **Member Management** — Approve/reject pending members, promote to admin

## Core User Flows

### 1. Member Sign-up & Approval

Google Login → First-time user detected → Sign-up wizard (required info → optional KAIST → optional company) → Pending status → Admin sees notification in Member Management → Approves → Member gets full access

### 2. Event Creation & RSVP

**Organizer:** Create event (set fees per member/adult guest/child guest) → Publish → Copy shareable link → Paste in KakaoTalk
**Member:** Click link / see on dashboard → View event details → RSVP: Going/Maybe/Not Going + adult guests + child guests → Can change before RSVP deadline

### 3. Fee Payment & Tracking

**Member:** See fee breakdown on event page ("You: $30 + 1 adult guest $30 + 2 kids free = $60") → Pay externally (Venmo/Zelle/PayPal) → Click "I paid" + select method → Status: pending confirmation
**Organizer:** Attendee & Fee Dashboard shows everyone → paid / pending / unpaid at a glance → Check actual payment in Venmo/Zelle → Confirm or reject → Summary: "25/30 paid ($750/$900)"

## KakaoTalk Integration Strategy

We don't replace KakaoTalk — we reduce dependency on it. Organizers create events in the app, copy the shareable link, and paste it in the KakaoTalk group. Members click the link to see full event info, RSVP, and report payments — all in one persistent place. No more info lost in chat history.

## Technical Notes

- Mobile-first responsive design (primary use case is phone)
- Supabase RLS for row-level security on all tables (see RLS Policy Matrix above)
- Google OAuth already implemented in the existing codebase
- Shareable event links: logged-in members see full event; non-authenticated users redirect to login
- Pending users see approval-pending page regardless of URL
- Sign-up form uses multi-step wizard pattern for better mobile UX
- Timezone: All event times displayed in Pacific Time (PT) — target audience is Silicon Valley based
- Organizer permission checks require joining `event_organizers` table in RLS policies
- Multiple admins supported — any admin can approve members and delegate organizer roles

## Future Enhancements (v1.1+)

- Carpool matching system
- Stripe payment integration (replace manual tracking)
- Email/push notifications for events and payment reminders
- Invite link system for member referrals
- Event photo gallery
- Recurring event templates
- Admin Settings page (org-level configuration)
- Advanced event filtering (by date range, category, etc.)
