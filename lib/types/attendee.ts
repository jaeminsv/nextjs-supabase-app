/**
 * Shared types for the attendee roster feature.
 * Kept in lib/types/ so both lib/queries/ and app/ can import without circular deps.
 */

// Minimal profile fields shown in the attendee list (subset of the full Profile type)
export interface AttendeeProfile {
  id: string;
  display_name: string;
  kaist_bs_year: number | null;
  kaist_ms_year: number | null;
  kaist_phd_year: number | null;
  company: string | null;
  job_title: string | null;
}

// Controls how the attendee roster section is rendered for the current viewer.
// "hidden"  — the section is not rendered at all
// "pending" — section shows a "payment pending confirmation" message, no list
// "visible" — section shows the full attendee list
export type RosterAccess = "hidden" | "pending" | "visible";
