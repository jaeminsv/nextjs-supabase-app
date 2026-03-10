/**
 * Profile types for KAIST alumni members.
 * Each user who signs up has a corresponding Profile record in the database.
 */

// Defines all possible roles a user can have in the system.
// "as const" ensures TypeScript treats these as literal types, not just strings.
export const PROFILE_ROLES = {
  // New user who hasn't been approved yet
  PENDING: "pending",
  // Regular approved member
  MEMBER: "member",
  // Administrator with elevated privileges
  ADMIN: "admin",
} as const;

// Derives the union type from the PROFILE_ROLES object values.
// Result: "pending" | "member" | "admin"
export type ProfileRole = (typeof PROFILE_ROLES)[keyof typeof PROFILE_ROLES];

/**
 * Represents a user's profile with personal, academic, and payment information.
 * This record is created when a user signs up and must be filled out to participate in events.
 */
export interface Profile {
  // Unique identifier matching the Supabase auth user UUID
  id: string;

  // User's email address, synced from Supabase auth
  email: string;

  // User's real legal name (used for official records)
  full_name: string;

  // Name shown in the UI (can be a nickname or shortened name)
  display_name: string;

  // User's contact phone number
  phone: string;

  // Year the user graduated from KAIST with a Bachelor's degree (e.g. 2010)
  // null if the user did not complete a BS at KAIST
  kaist_bs_year: number | null;

  // Major studied during the Bachelor's program at KAIST
  // null if kaist_bs_year is null
  kaist_bs_major: string | null;

  // Whether the user is enrolled in (or completed) the integrated MS/PhD program at KAIST
  // If true, kaist_ms_year is not applicable
  is_integrated_ms_phd: boolean;

  // Year the user graduated from KAIST with a Master's degree
  // null if is_integrated_ms_phd is true, or if no MS degree from KAIST
  kaist_ms_year: number | null;

  // Major studied during the Master's program at KAIST
  // null if kaist_ms_year is null
  kaist_ms_major: string | null;

  // Year the user graduated from KAIST with a PhD degree
  // null if the user did not complete a PhD at KAIST
  kaist_phd_year: number | null;

  // Major studied during the PhD program at KAIST
  // null if kaist_phd_year is null
  kaist_phd_major: string | null;

  // Current company or organization the user works for
  // null if not provided
  company: string | null;

  // User's current job title or position
  // null if not provided
  job_title: string | null;

  // Venmo username for receiving payments (e.g. "@username")
  // null if the user has not set up Venmo
  venmo_handle: string | null;

  // Zelle identifier (phone number or email) for receiving payments
  // null if the user has not set up Zelle
  zelle_handle: string | null;

  // The user's role in the system, controlling access and permissions
  role: ProfileRole;

  // ISO 8601 datetime string when this profile was first created
  created_at: string;

  // ISO 8601 datetime string when this profile was last modified
  updated_at: string;
}
