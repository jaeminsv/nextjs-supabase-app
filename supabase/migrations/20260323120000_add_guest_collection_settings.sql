-- =============================================================================
-- Add guest collection settings to events and split child_guests in rsvps
-- =============================================================================
-- Context: Previously, all events collected adult_guests and child_guests.
-- This migration allows event creators to configure which companion types
-- to collect per event (adult guests, children with meal, children without meal).
--
-- NOTE: The existing child_guest_fee column now represents the fee for
-- children WHO NEED A MEAL. The new child_guest_no_meal_fee column covers
-- children who do NOT need a meal (default 0).
--
-- Changes:
--   events table:
--     + collect_adult_guests       BOOLEAN DEFAULT true  (survey adult guests?)
--     + collect_child_guests_with_meal  BOOLEAN DEFAULT true  (survey meal-children?)
--     + collect_child_guests_no_meal    BOOLEAN DEFAULT true  (survey no-meal-children?)
--     + child_guest_no_meal_fee    NUMERIC DEFAULT 0     (fee for no-meal child guests)
--
--   rsvps table:
--     + child_guests_with_meal     INTEGER DEFAULT 0     (children who need a meal)
--     + child_guests_no_meal       INTEGER DEFAULT 0     (children who don't need a meal)
--
-- Data migration:
--   Existing rsvps.child_guests values are copied to child_guests_with_meal.
--   The original child_guests column is retained for backward compatibility.
--
-- Security: No additional RLS policy needed.
-- Existing policies cover all new columns on both tables.
-- =============================================================================

-- Add companion collection flag columns to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS collect_adult_guests BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS collect_child_guests_with_meal BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS collect_child_guests_no_meal BOOLEAN NOT NULL DEFAULT true;

-- Add fee column for children who do not need a meal (typically 0)
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS child_guest_no_meal_fee NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Split child_guests into two separate columns in rsvps table
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS child_guests_with_meal INTEGER NOT NULL DEFAULT 0
    CHECK (child_guests_with_meal >= 0);

ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS child_guests_no_meal INTEGER NOT NULL DEFAULT 0
    CHECK (child_guests_no_meal >= 0);

-- Migrate existing child_guests data into child_guests_with_meal.
-- Assumes all existing child guests were attending with a meal (the original behavior).
UPDATE public.rsvps
  SET child_guests_with_meal = child_guests
  WHERE child_guests > 0;
