import { z } from "zod";

// Step 1: Basic required information — name, display name, phone number
// These fields are mandatory for every new member during onboarding
export const step1Schema = z.object({
  // Full legal name of the member (minimum 2 characters)
  full_name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  // Display name shown to other members (minimum 2 characters)
  display_name: z.string().min(2, "표시 이름은 2자 이상이어야 합니다"),
  // Contact phone number (minimum 5 characters to allow international formats)
  phone: z.string().min(5, "연락처를 입력해주세요"),
});
export type Step1FormData = z.infer<typeof step1Schema>;

// Step 2: KAIST academic history — all optional because some members
// may not have certain degrees (e.g. MS-only or PhD-only alumni)
//
// Note on year fields: HTML <input type="number"> with `valueAsNumber` returns
// NaN when left blank. The onboarding form handles this by using plain string
// inputs and converting to number only when submitting, so these remain
// z.number().optional() to preserve correct TypeScript inference.
export const step2Schema = z.object({
  // Year the member received their Bachelor's degree from KAIST (e.g. 2010)
  kaist_bs_year: z.number().int().positive().optional(),
  // Department/major for Bachelor's degree (e.g. "Computer Science")
  kaist_bs_major: z.string().optional(),
  // Whether the member was enrolled in the integrated MS/PhD program
  // When true, the separate MS year/major fields should be hidden in the UI
  is_integrated_ms_phd: z.boolean().default(false),
  // Year the member received their Master's degree — hidden when is_integrated_ms_phd=true
  kaist_ms_year: z.number().int().positive().optional(),
  // Department/major for Master's degree
  kaist_ms_major: z.string().optional(),
  // Year the member received their PhD
  kaist_phd_year: z.number().int().positive().optional(),
  // Department/major for PhD
  kaist_phd_major: z.string().optional(),
});
export type Step2FormData = z.infer<typeof step2Schema>;

// Step 3: Professional info — all optional
// Members can fill these in later via profile settings
export const step3Schema = z.object({
  // Current employer or organization the member works for
  company: z.string().optional(),
  // Member's job title or role at their company
  job_title: z.string().optional(),
});
export type Step3FormData = z.infer<typeof step3Schema>;

// Combined schema for the complete onboarding form
// Merges all three step schemas into a single flat object schema
// Used for final validation before submitting the full onboarding data
export const onboardingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema);
export type OnboardingFormData = z.infer<typeof onboardingSchema>;
