"use client";

/**
 * ProfileClient — interactive view/edit form for the user's profile.
 *
 * This is a Client Component because it uses useState, useForm, and
 * event handlers. The parent Server Component (profile/page.tsx) fetches
 * the real profile from Supabase and passes it as a prop.
 *
 * Modes:
 *   - View mode  : all fields shown as plain read-only text
 *   - Edit mode  : fields shown as form inputs with Zod validation
 *
 * Sections:
 *   1. Personal info   (full_name readonly, display_name, phone)
 *   2. KAIST academic  (BS, optional MS, PhD — year stored as string in form)
 *   3. Company info    (company, job_title)
 *
 * Year fields are stored as strings inside the form to avoid NaN issues
 * with <input type="number"> + zodResolver. They are converted to integers
 * via parseYear() only at submit time.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { updateProfile } from "@/actions/profile";
import { signOut } from "@/actions/auth";
import type { ProfileUpdateData } from "@/actions/profile";
import type { Database } from "@/lib/supabase/database.types";

// Convenience alias — matches the shape Supabase returns from profiles table
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProfileClientProps {
  /** The authenticated user's profile row, fetched by the Server Component. */
  profile: Profile;
}

// ---------------------------------------------------------------------------
// Zod form schema
// ---------------------------------------------------------------------------

/**
 * Defines the shape and validation rules for the editable profile fields.
 * - full_name is excluded because it is always read-only.
 * - Year fields are strings here to avoid NaN with HTML number inputs;
 *   they are converted to numbers in onSubmit via parseYear().
 */
const formSchema = z.object({
  display_name: z.string().min(2, "표시 이름은 2자 이상이어야 합니다"),
  phone: z.string().min(5, "연락처를 입력해주세요"),
  // Year fields stored as strings
  kaist_bs_year: z.string().optional(),
  kaist_bs_major: z.string().optional(),
  // No .default(false) — defaultValues in useForm provides the boolean
  is_integrated_ms_phd: z.boolean(),
  kaist_ms_year: z.string().optional(),
  kaist_ms_major: z.string().optional(),
  kaist_phd_year: z.string().optional(),
  kaist_phd_major: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Returns the string value, or '미입력' if the value is null / undefined / empty.
 * Used in view mode to display fields that the user may not have filled in.
 */
const displayValue = (val: string | number | null | undefined) =>
  val !== null && val !== undefined && String(val).trim() !== ""
    ? String(val)
    : "미입력";

/**
 * Converts a string year value from the form input to an integer, or returns
 * undefined when the string is empty or not a valid number.
 *
 * @param value - The raw string from the year <input>
 */
function parseYear(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileClient({ profile }: ProfileClientProps) {
  // true → user is in edit mode, false → read-only view mode
  const [isEditing, setIsEditing] = useState(false);

  // Submission state for async server action
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    // Pre-fill the form with the real profile data from Supabase
    defaultValues: {
      display_name: profile.display_name,
      phone: profile.phone ?? "",
      // Convert numeric year to string for the input, or empty string if null
      kaist_bs_year: profile.kaist_bs_year ? String(profile.kaist_bs_year) : "",
      kaist_bs_major: profile.kaist_bs_major ?? "",
      is_integrated_ms_phd: profile.is_integrated_ms_phd,
      kaist_ms_year: profile.kaist_ms_year ? String(profile.kaist_ms_year) : "",
      kaist_ms_major: profile.kaist_ms_major ?? "",
      kaist_phd_year: profile.kaist_phd_year
        ? String(profile.kaist_phd_year)
        : "",
      kaist_phd_major: profile.kaist_phd_major ?? "",
      company: profile.company ?? "",
      job_title: profile.job_title ?? "",
    },
  });

  // Watch the checkbox so we can conditionally show/hide the MS year fields
  const isIntegratedMsPhd = watch("is_integrated_ms_phd");

  /**
   * Handles form submission.
   * Converts string year fields to integers and calls the updateProfile action.
   */
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setSubmitError(null);

    // Convert year strings → numbers (undefined if empty)
    const transformed = {
      ...data,
      kaist_bs_year: parseYear(data.kaist_bs_year),
      kaist_ms_year: parseYear(data.kaist_ms_year),
      kaist_phd_year: parseYear(data.kaist_phd_year),
    };

    // Build the payload for updateProfile, converting undefined → null for nullable DB fields.
    // Empty strings from optional text inputs are treated as null (clear the field).
    const payload: ProfileUpdateData = {
      display_name: transformed.display_name,
      phone: transformed.phone,
      kaist_bs_year: transformed.kaist_bs_year ?? null,
      kaist_bs_major: transformed.kaist_bs_major || null,
      is_integrated_ms_phd: transformed.is_integrated_ms_phd,
      kaist_ms_year: transformed.kaist_ms_year ?? null,
      kaist_ms_major: transformed.kaist_ms_major || null,
      kaist_phd_year: transformed.kaist_phd_year ?? null,
      kaist_phd_major: transformed.kaist_phd_major || null,
      company: transformed.company || null,
      job_title: transformed.job_title || null,
    };

    const result = await updateProfile(payload);
    if (result.error) {
      setSubmitError(result.error);
      setIsSubmitting(false);
      return;
    }

    // Success: exit edit mode. revalidatePath in the action refreshes the Server Component.
    setIsSubmitting(false);
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      {/* ── Header: title left, action buttons right ── */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 프로필</h1>

        <div className="flex gap-2">
          {!isEditing ? (
            // View mode: single "Edit" button
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              수정하기
            </Button>
          ) : (
            // Edit mode: Cancel restores defaults, Save submits
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  // Reset form back to the profile values and exit edit mode
                  reset();
                  setSubmitError(null);
                  setIsEditing(false);
                }}
              >
                취소
              </Button>
              <Button
                size="sm"
                disabled={isSubmitting}
                onClick={handleSubmit(onSubmit)}
              >
                {isSubmitting ? "저장 중..." : "저장"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Global save error (shown below the header) */}
      {submitError && (
        <p className="mb-4 rounded border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      {/* Wrap all sections in <form> so Enter key also triggers submit */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* ── Section 1: Personal information ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">개인 정보</h2>

          <div className="flex flex-col gap-4">
            {/* full_name: always read-only — cannot be changed after onboarding */}
            <div className="grid gap-1">
              <Label>실명</Label>
              <p className="text-sm">{profile.full_name}</p>
            </div>

            {/* display_name: editable nickname shown in the UI */}
            <div className="grid gap-1">
              <Label htmlFor="display_name">표시 이름</Label>
              {isEditing ? (
                <>
                  <Input id="display_name" {...register("display_name")} />
                  {errors.display_name?.message && (
                    <p className="text-sm text-destructive">
                      {errors.display_name.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">{displayValue(profile.display_name)}</p>
              )}
            </div>

            {/* phone: editable contact number */}
            <div className="grid gap-1">
              <Label htmlFor="phone">연락처</Label>
              {isEditing ? (
                <>
                  <Input id="phone" {...register("phone")} />
                  {errors.phone?.message && (
                    <p className="text-sm text-destructive">
                      {errors.phone.message}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm">{displayValue(profile.phone)}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 2: KAIST academic history ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">KAIST 학력</h2>

          <div className="flex flex-col gap-4">
            {/* Bachelor's admission year (입학 연도, not graduation year) */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_bs_year">학사 입학 연도</Label>
              {isEditing ? (
                <Input
                  id="kaist_bs_year"
                  type="number"
                  {...register("kaist_bs_year")}
                />
              ) : (
                <p className="text-sm">{displayValue(profile.kaist_bs_year)}</p>
              )}
            </div>

            {/* Bachelor's major */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_bs_major">학사 전공</Label>
              {isEditing ? (
                <Input id="kaist_bs_major" {...register("kaist_bs_major")} />
              ) : (
                <p className="text-sm">
                  {displayValue(profile.kaist_bs_major)}
                </p>
              )}
            </div>

            {/* Integrated MS/PhD program checkbox */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_integrated_ms_phd"
                  checked={isIntegratedMsPhd}
                  onCheckedChange={(checked) => {
                    // Checkbox is not a native input, so we update the form value manually
                    setValue("is_integrated_ms_phd", checked === true, {
                      shouldValidate: true,
                    });
                  }}
                />
                <Label
                  htmlFor="is_integrated_ms_phd"
                  className="cursor-pointer"
                >
                  석박사 통합과정
                </Label>
              </div>
            ) : (
              // View mode: show as a simple text label
              <div className="grid gap-1">
                <Label>석박사 통합과정</Label>
                <p className="text-sm">
                  {profile.is_integrated_ms_phd ? "예" : "아니오"}
                </p>
              </div>
            )}

            {/* Master's fields — hidden when integrated MS/PhD is checked */}
            {!isIntegratedMsPhd && (
              <>
                {/* Master's admission year (입학 연도) */}
                <div className="grid gap-1">
                  <Label htmlFor="kaist_ms_year">석사 입학 연도</Label>
                  {isEditing ? (
                    <Input
                      id="kaist_ms_year"
                      type="number"
                      {...register("kaist_ms_year")}
                    />
                  ) : (
                    <p className="text-sm">
                      {displayValue(profile.kaist_ms_year)}
                    </p>
                  )}
                </div>

                {/* Master's major */}
                <div className="grid gap-1">
                  <Label htmlFor="kaist_ms_major">석사 전공</Label>
                  {isEditing ? (
                    <Input
                      id="kaist_ms_major"
                      {...register("kaist_ms_major")}
                    />
                  ) : (
                    <p className="text-sm">
                      {displayValue(profile.kaist_ms_major)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* PhD admission year (입학 연도) */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_phd_year">박사 입학 연도</Label>
              {isEditing ? (
                <Input
                  id="kaist_phd_year"
                  type="number"
                  {...register("kaist_phd_year")}
                />
              ) : (
                <p className="text-sm">
                  {displayValue(profile.kaist_phd_year)}
                </p>
              )}
            </div>

            {/* PhD major */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_phd_major">박사 전공</Label>
              {isEditing ? (
                <Input id="kaist_phd_major" {...register("kaist_phd_major")} />
              ) : (
                <p className="text-sm">
                  {displayValue(profile.kaist_phd_major)}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 3: Company information ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">직장 정보</h2>

          <div className="flex flex-col gap-4">
            {/* Current employer */}
            <div className="grid gap-1">
              <Label htmlFor="company">회사</Label>
              {isEditing ? (
                <Input id="company" {...register("company")} />
              ) : (
                <p className="text-sm">{displayValue(profile.company)}</p>
              )}
            </div>

            {/* Job title / position */}
            <div className="grid gap-1">
              <Label htmlFor="job_title">직책</Label>
              {isEditing ? (
                <Input id="job_title" {...register("job_title")} />
              ) : (
                <p className="text-sm">{displayValue(profile.job_title)}</p>
              )}
            </div>
          </div>
        </section>
      </form>

      {/* ── Logout section ── */}
      {/*
       * Using a <form> with a server action is the recommended Next.js pattern
       * for logout buttons. This avoids the redirect()-inside-try-catch problem
       * because form actions handle redirects at the framework level.
       */}
      <div className="mt-6 border-t pt-6">
        <form action={signOut}>
          <Button
            type="submit"
            variant="outline"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            로그아웃
          </Button>
        </form>
      </div>
    </div>
  );
}
