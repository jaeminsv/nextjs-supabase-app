-- =============================================================================
-- KAIST Silicon Valley Alumni Association — Initial Schema Migration
-- =============================================================================
-- Order of operations (dependency-safe):
--   0. Drop legacy objects from prior dev migrations (idempotent cleanup)
--   1. Enum types
--   2. handle_updated_at() trigger function (no table dependency)
--   3. Tables (profiles first, then tables that reference it)
--   4. get_my_role() function (must come AFTER profiles table is created)
--   5. Triggers
--   6. Indexes
--   7. RLS enable + policies
-- =============================================================================


-- =============================================================================
-- 0. CLEANUP — drop legacy objects from prior dev migrations
-- =============================================================================

-- Drop legacy tables that were created during early development.
-- CASCADE automatically drops dependent objects (triggers, indexes, constraints).
DROP TABLE IF EXISTS public.instruments CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop the auth trigger if it already exists (idempotent: safe to run multiple times)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Drop helper functions if they already exist (replaced by this migration)
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_my_role() CASCADE;


-- =============================================================================
-- 1. ENUM TYPES
-- =============================================================================

-- Roles a user can hold in the system
CREATE TYPE user_role AS ENUM ('pending', 'member', 'admin');

-- Lifecycle states of an event
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- Possible RSVP responses from a member
CREATE TYPE rsvp_status AS ENUM ('going', 'maybe', 'not_going');

-- Payment review states
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'rejected');

-- Supported payment services
CREATE TYPE payment_method AS ENUM ('venmo', 'zelle', 'paypal', 'other');


-- =============================================================================
-- 2. HELPER FUNCTION: handle_updated_at (no table dependency)
-- =============================================================================

-- Trigger function that automatically sets updated_at to the current timestamp
-- before any UPDATE operation. Used by multiple tables via individual triggers.
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 3. TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per authenticated user, mirrors auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  -- Primary key matches the Supabase auth user UUID exactly
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Email synced from auth; stored here for easy querying
  email                TEXT        NOT NULL DEFAULT '',

  -- Legal full name (used for records and official communications)
  full_name            TEXT        NOT NULL DEFAULT '',

  -- Display name shown in the UI (nickname or preferred name)
  display_name         TEXT        NOT NULL DEFAULT '',

  -- Contact phone number
  phone                TEXT        NOT NULL DEFAULT '',

  -- KAIST Bachelor's degree graduation year (null if no BS from KAIST)
  kaist_bs_year        INTEGER,

  -- Major during the BS program
  kaist_bs_major       TEXT,

  -- True if the user is in the integrated MS/PhD track (no separate MS year)
  is_integrated_ms_phd BOOLEAN     NOT NULL DEFAULT false,

  -- KAIST Master's degree graduation year (null if integrated or no MS)
  kaist_ms_year        INTEGER,

  -- Major during the MS program
  kaist_ms_major       TEXT,

  -- KAIST PhD graduation year (null if no PhD from KAIST)
  kaist_phd_year       INTEGER,

  -- Major during the PhD program
  kaist_phd_major      TEXT,

  -- Current employer
  company              TEXT,

  -- Current job title or position
  job_title            TEXT,

  -- Venmo handle for receiving payments (e.g. "@username")
  venmo_handle         TEXT,

  -- Zelle identifier (phone or email) for receiving payments
  zelle_handle         TEXT,

  -- System role controlling access level; new users start as 'pending'
  role                 user_role   NOT NULL DEFAULT 'pending',

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. get_my_role() — must be defined AFTER profiles table exists
-- =============================================================================

-- Returns the role of the currently authenticated user as TEXT.
-- SECURITY DEFINER: runs with the privileges of the function owner (postgres),
-- bypassing RLS on the profiles table. This avoids a circular dependency where
-- RLS policies call get_my_role(), which needs to read profiles — an infinite loop.
-- STABLE: PostgreSQL can cache the result within a single query execution.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role::TEXT
  FROM public.profiles
  WHERE id = auth.uid();
$$;


-- ---------------------------------------------------------------------------
-- events: community gatherings organized by admins/organizers
-- ---------------------------------------------------------------------------
CREATE TABLE public.events (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Short title visible to all members (e.g. "Spring Picnic 2026")
  title                 TEXT          NOT NULL,

  -- Optional long-form description; supports Markdown
  description           TEXT,

  -- When the event starts (required)
  start_at              TIMESTAMPTZ   NOT NULL,

  -- When the event ends (null = open-ended)
  end_at                TIMESTAMPTZ,

  -- Deadline after which RSVPs are no longer accepted (null = no deadline)
  rsvp_deadline         TIMESTAMPTZ,

  -- Venue address or name (required)
  location              TEXT          NOT NULL,

  -- Base attendance fee per adult member in USD (0 = free)
  fee_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Extra fee per adult non-member guest brought by a member
  adult_guest_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Extra fee per child guest brought by a member
  child_guest_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Instructions for submitting payment (e.g. "Venmo @handle")
  payment_instructions  TEXT,

  -- Maximum number of attendees; null means unlimited
  max_capacity          INTEGER,

  -- Current lifecycle state; new events start as 'draft'
  status                event_status  NOT NULL DEFAULT 'draft',

  -- The profile that created this event (required, non-nullable)
  created_by            UUID          NOT NULL REFERENCES public.profiles(id),

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- event_organizers: maps which members help organize each event
-- Composite primary key prevents duplicate assignments.
-- ---------------------------------------------------------------------------
CREATE TABLE public.event_organizers (
  event_id  UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  PRIMARY KEY (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- rsvps: one row per (member x event) attendance response
-- ---------------------------------------------------------------------------
CREATE TABLE public.rsvps (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id      UUID        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- The member's attendance intention
  status        rsvp_status NOT NULL,

  -- Extra adult guests the member brings (not counting themselves)
  adult_guests  INTEGER     NOT NULL DEFAULT 0 CHECK (adult_guests >= 0),

  -- Child guests the member brings
  child_guests  INTEGER     NOT NULL DEFAULT 0 CHECK (child_guests >= 0),

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each member can only have one RSVP per event
  UNIQUE (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- payments: fee submissions linked to an RSVP, confirmed by organizers
-- ---------------------------------------------------------------------------
CREATE TABLE public.payments (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),

  event_id      UUID           NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID           NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Links to the member's RSVP so organizers know what the payment covers
  rsvp_id       UUID           NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,

  -- Self-reported dollar amount the member claims to have sent
  amount        NUMERIC(10,2)  NOT NULL CHECK (amount >= 0),

  -- Payment channel used
  method        payment_method NOT NULL,

  -- Review state; starts as 'pending' until an organizer acts on it
  status        payment_status NOT NULL DEFAULT 'pending',

  -- Optional note from the payer (e.g. "Sent for Spring Picnic")
  note          TEXT,

  -- Organizer who confirmed or rejected this payment (null until reviewed)
  confirmed_by  UUID           REFERENCES public.profiles(id),

  -- When the payment was confirmed or rejected (null until reviewed)
  confirmed_at  TIMESTAMPTZ,

  created_at    TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT now()
);


-- =============================================================================
-- 4. TRIGGERS
-- =============================================================================

-- Automatically create a minimal profile stub when a new user signs up via auth.
-- SECURITY DEFINER is required because this trigger runs in the auth schema
-- context, which does not normally have write access to public.profiles.
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    -- Use full_name from raw_user_meta_data if available (set during Google OAuth),
    -- otherwise fall back to the email prefix as a reasonable default.
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Fire handle_new_auth_user after every new row in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- Auto-update updated_at on profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-update updated_at on events
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-update updated_at on rsvps
CREATE TRIGGER rsvps_updated_at
  BEFORE UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-update updated_at on payments
CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- =============================================================================
-- 5. INDEXES
-- =============================================================================

-- profiles: quickly find all users with a given role (e.g. list all pending approvals)
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- events: filter by status (e.g. show only published events)
CREATE INDEX idx_events_status ON public.events (status);

-- events: order events chronologically on the calendar view
CREATE INDEX idx_events_start_at ON public.events (start_at);

-- events: find all events created by a specific user
CREATE INDEX idx_events_created_by ON public.events (created_by);

-- rsvps: list all RSVPs for a given event (attendance list)
CREATE INDEX idx_rsvps_event_id ON public.rsvps (event_id);

-- rsvps: list all RSVPs made by a specific user (member history)
CREATE INDEX idx_rsvps_user_id ON public.rsvps (user_id);

-- payments: list all payments for a given event
CREATE INDEX idx_payments_event_id ON public.payments (event_id);

-- payments: list all payments made by a specific user
CREATE INDEX idx_payments_user_id ON public.payments (user_id);

-- payments: filter payments by review status (e.g. show pending payments)
CREATE INDEX idx_payments_status ON public.payments (status);

-- event_organizers: find all events a user is organizing
CREATE INDEX idx_event_organizers_user_id ON public.event_organizers (user_id);


-- =============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all public tables
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments         ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- profiles policies (5)
-- ---------------------------------------------------------------------------

-- (1) Any authenticated user can read their own profile
CREATE POLICY users_select_own_profile ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- (2) Approved members and admins can read all profiles (e.g. member directory)
CREATE POLICY members_select_all_profiles ON public.profiles
  FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('member', 'admin'));

-- (3) A user can only insert their own profile row (id must match their auth uid)
CREATE POLICY users_insert_own_profile ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- (4) A user can update their own profile, but CANNOT change their own role.
-- WITH CHECK ensures that after the update, the role column still matches
-- what get_my_role() returns — preventing self-elevation of privileges.
CREATE POLICY users_update_own_profile ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role::TEXT = get_my_role());

-- (5) Admins can update any profile (e.g. to approve pending members)
CREATE POLICY admins_update_any_profile ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ---------------------------------------------------------------------------
-- events policies (4)
-- ---------------------------------------------------------------------------

-- (1) Anyone (including unauthenticated visitors) can view published events
CREATE POLICY anyone_select_published_events ON public.events
  FOR SELECT
  USING (status = 'published');

-- (2) Organizers of an event (and admins) can view all events including drafts
CREATE POLICY organizers_select_all_events ON public.events
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.event_organizers
      WHERE event_organizers.event_id = events.id
        AND event_organizers.user_id = auth.uid()
    )
  );

-- (3) Only admins can create new events
CREATE POLICY admins_insert_events ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- (4) Organizers of this specific event (and admins) can edit it
CREATE POLICY organizers_update_events ON public.events
  FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.event_organizers
      WHERE event_organizers.event_id = events.id
        AND event_organizers.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- event_organizers policies (3)
-- ---------------------------------------------------------------------------

-- (1) Organizers of an event can see the organizer list for that event
CREATE POLICY organizers_select_event_organizers ON public.event_organizers
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.event_organizers AS eo
      WHERE eo.event_id = event_organizers.event_id
        AND eo.user_id = auth.uid()
    )
  );

-- (2) Only admins can assign organizers to events
CREATE POLICY admins_insert_event_organizers ON public.event_organizers
  FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() = 'admin');

-- (3) Only admins can remove organizers from events
CREATE POLICY admins_delete_event_organizers ON public.event_organizers
  FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ---------------------------------------------------------------------------
-- rsvps policies (2)
-- ---------------------------------------------------------------------------

-- (1) Members can create, read, update, and delete their own RSVPs
CREATE POLICY users_manage_own_rsvps ON public.rsvps
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- (2) Organizers of the event (and admins) can view all RSVPs for their event
CREATE POLICY organizers_select_event_rsvps ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.event_organizers
      WHERE event_organizers.event_id = rsvps.event_id
        AND event_organizers.user_id = auth.uid()
    )
  );


-- ---------------------------------------------------------------------------
-- payments policies (4)
-- ---------------------------------------------------------------------------

-- (1) Members can submit a payment only for their own RSVPs
CREATE POLICY users_insert_own_payments ON public.payments
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- (2) Members can view their own payment submissions
CREATE POLICY users_select_own_payments ON public.payments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- (3) Organizers of the event (and admins) can view all payments for their event
CREATE POLICY organizers_select_event_payments ON public.payments
  FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.event_organizers
      WHERE event_organizers.event_id = payments.event_id
        AND event_organizers.user_id = auth.uid()
    )
  );

-- (4) Organizers of the event (and admins) can update payment status
--     (e.g. to confirm or reject a payment submission)
CREATE POLICY organizers_update_payment_status ON public.payments
  FOR UPDATE
  TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.event_organizers
      WHERE event_organizers.event_id = payments.event_id
        AND event_organizers.user_id = auth.uid()
    )
  );
