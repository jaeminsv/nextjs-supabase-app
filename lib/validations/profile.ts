import { z } from "zod";

// Schema for the profile update (edit) form
// All fields are optional — only the fields the member wants to change need to be sent
// This allows partial updates without requiring the full profile to be resubmitted
export const profileUpdateSchema = z.object({
  // Display name shown to other members (minimum 2 characters if provided)
  display_name: z.string().min(2).optional(),
  // Contact phone number (minimum 5 characters if provided)
  phone: z.string().min(5).optional(),
  // Year the member received their Bachelor's degree from KAIST
  kaist_bs_year: z.number().int().positive().optional(),
  // Department/major for Bachelor's degree
  kaist_bs_major: z.string().optional(),
  // Whether the member was in the integrated MS/PhD program
  is_integrated_ms_phd: z.boolean().optional(),
  // Year the member received their Master's degree from KAIST
  kaist_ms_year: z.number().int().positive().optional(),
  // Department/major for Master's degree
  kaist_ms_major: z.string().optional(),
  // Year the member received their PhD from KAIST
  kaist_phd_year: z.number().int().positive().optional(),
  // Department/major for PhD
  kaist_phd_major: z.string().optional(),
  // Current employer or organization
  company: z.string().optional(),
  // Member's job title or role
  job_title: z.string().optional(),
  // Venmo username for payments (e.g. "@username")
  venmo_handle: z.string().optional(),
  // Zelle identifier — typically a phone number or email address
  zelle_handle: z.string().optional(),
});
export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
