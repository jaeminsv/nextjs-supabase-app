-- =============================================================================
-- KAIST Silicon Valley Alumni Association — Seed Data
-- =============================================================================
--
-- PURPOSE:
--   Set up the first admin user after initial production deployment.
--   This script must be run AFTER the target user has logged in at least once
--   via Google OAuth (the auth trigger auto-creates their profile on first login).
--
-- PREREQUISITES:
--   1. Supabase migrations have been applied (supabase db push)
--   2. The target user has logged in via Google OAuth at least once
--   3. You have the user's UUID from Supabase Dashboard
--
-- HOW TO USE:
--   Step 1: Deploy the app and navigate to the login page
--   Step 2: Log in with the Google account you want to make admin
--   Step 3: Go to Supabase Dashboard > Authentication > Users
--   Step 4: Copy the UUID of your user (the "User UID" column)
--   Step 5: Replace <AUTH_USER_UUID> below with your actual UUID
--   Step 6: Run this script in Supabase Dashboard > SQL Editor
--
-- EXAMPLE UUID FORMAT: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- =============================================================================


-- =============================================================================
-- STEP 1: Promote first user to admin
-- =============================================================================
-- Replace <AUTH_USER_UUID> with the actual UUID from Supabase Auth dashboard.
-- The user must have logged in at least once before running this.

UPDATE public.profiles
SET role = 'admin'
WHERE id = '<AUTH_USER_UUID>';

-- Verify the update was successful (should return 1 row with role = 'admin')
SELECT id, display_name, email, role, created_at
FROM public.profiles
WHERE id = '<AUTH_USER_UUID>';


-- =============================================================================
-- STEP 2 (Optional): Verify no pending users are stuck
-- =============================================================================
-- Lists all users with their current roles for a quick sanity check.

SELECT
  id,
  display_name,
  email,
  role,
  created_at
FROM public.profiles
ORDER BY created_at ASC;
