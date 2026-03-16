"use client";

/**
 * Profile page — view and edit personal information.
 *
 * Displays the current user's profile in two modes:
 *   - View mode: all fields shown as plain text (read-only)
 *   - Edit mode: fields shown as form inputs with validation
 *
 * Sections:
 *   1. Personal info (full_name readonly, display_name, phone)
 *   2. KAIST academic history (BS, optional MS, PhD)
 *   3. Company info (company, job_title)
 *   4. Payment handles (Venmo, Zelle)
 *
 * Year fields are stored as strings in the form to avoid the NaN issue
 * with HTML number inputs + zodResolver. They are converted to numbers
 * via parseYear() only at submit time.
 *
 * Phase 2 (Task 009): Dummy UI — changes are only logged to the console.
 * Phase 3: Will call an updateProfile server action.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CURRENT_USER } from "@/lib/dummy-data/profiles";

// ---------------------------------------------------------------------------
// Form schema — mirrors the Profile shape but uses strings for year fields.
// full_name is intentionally excluded because it is always read-only.
// ---------------------------------------------------------------------------

const formSchema = z.object({
  display_name: z.string().min(2, "표시 이름은 2자 이상이어야 합니다"),
  phone: z.string().min(5, "연락처를 입력해주세요"),
  // Year fields stored as strings to avoid NaN with <input type="number">
  kaist_bs_year: z.string().optional(),
  kaist_bs_major: z.string().optional(),
  // No .default(false) here — default provided via useForm's defaultValues
  is_integrated_ms_phd: z.boolean(),
  kaist_ms_year: z.string().optional(),
  kaist_ms_major: z.string().optional(),
  kaist_phd_year: z.string().optional(),
  kaist_phd_major: z.string().optional(),
  company: z.string().optional(),
  job_title: z.string().optional(),
  venmo_handle: z.string().optional(),
  zelle_handle: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Returns the string representation of a value, or '미입력' if empty/null.
 * Used in view mode to display fields that may not have a value set yet.
 */
const displayValue = (val: string | number | null | undefined) =>
  val !== null && val !== undefined && String(val).trim() !== ""
    ? String(val)
    : "미입력";

/**
 * Converts a string year value (from the number input) to a number,
 * or returns undefined if the string is empty or not a valid integer.
 */
function parseYear(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  // Controls whether the page is in view mode (false) or edit mode (true)
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      display_name: CURRENT_USER.display_name,
      phone: CURRENT_USER.phone ?? "",
      kaist_bs_year: CURRENT_USER.kaist_bs_year
        ? String(CURRENT_USER.kaist_bs_year)
        : "",
      kaist_bs_major: CURRENT_USER.kaist_bs_major ?? "",
      is_integrated_ms_phd: CURRENT_USER.is_integrated_ms_phd,
      kaist_ms_year: CURRENT_USER.kaist_ms_year
        ? String(CURRENT_USER.kaist_ms_year)
        : "",
      kaist_ms_major: CURRENT_USER.kaist_ms_major ?? "",
      kaist_phd_year: CURRENT_USER.kaist_phd_year
        ? String(CURRENT_USER.kaist_phd_year)
        : "",
      kaist_phd_major: CURRENT_USER.kaist_phd_major ?? "",
      company: CURRENT_USER.company ?? "",
      job_title: CURRENT_USER.job_title ?? "",
      venmo_handle: CURRENT_USER.venmo_handle ?? "",
      zelle_handle: CURRENT_USER.zelle_handle ?? "",
    },
  });

  // Watch the integrated MS/PhD checkbox to conditionally show MS fields
  const isIntegratedMsPhd = watch("is_integrated_ms_phd");

  /**
   * Called when the user submits the edit form.
   * Transforms string year values into numbers and logs the result.
   *
   * Phase 2: console.log only.
   * Phase 3 TODO: replace console.log with updateProfile server action.
   */
  const onSubmit = (data: FormValues) => {
    const transformed = {
      ...data,
      kaist_bs_year: parseYear(data.kaist_bs_year),
      kaist_ms_year: parseYear(data.kaist_ms_year),
      kaist_phd_year: parseYear(data.kaist_phd_year),
    };
    // Phase 3 TODO: replace console.log with updateProfile server action
    console.log("profile update:", transformed);
    setIsEditing(false);
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      {/* ── Header row: title on the left, action buttons on the right ── */}
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
            // Edit mode: "Cancel" resets the form, "Save" submits it
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Restore form values to the original defaults and exit edit mode
                  reset();
                  setIsEditing(false);
                }}
              >
                취소
              </Button>
              <Button size="sm" onClick={handleSubmit(onSubmit)}>
                저장
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Wrap content in a form element so pressing Enter also triggers submit */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* ── Section 1: Personal information ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">개인 정보</h2>

          <div className="flex flex-col gap-4">
            {/* full_name: always read-only regardless of editing state */}
            <div className="grid gap-1">
              <Label>실명</Label>
              <p className="text-sm">{CURRENT_USER.full_name}</p>
            </div>

            {/* display_name: editable */}
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
                <p className="text-sm">
                  {displayValue(CURRENT_USER.display_name)}
                </p>
              )}
            </div>

            {/* phone: editable */}
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
                <p className="text-sm">{displayValue(CURRENT_USER.phone)}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 2: KAIST academic history ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">KAIST 학력</h2>

          <div className="flex flex-col gap-4">
            {/* Bachelor's graduation year */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_bs_year">학사 졸업 연도</Label>
              {isEditing ? (
                <Input
                  id="kaist_bs_year"
                  type="number"
                  {...register("kaist_bs_year")}
                />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.kaist_bs_year)}
                </p>
              )}
            </div>

            {/* Bachelor's major */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_bs_major">학사 전공</Label>
              {isEditing ? (
                <Input id="kaist_bs_major" {...register("kaist_bs_major")} />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.kaist_bs_major)}
                </p>
              )}
            </div>

            {/* Integrated MS/PhD checkbox */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_integrated_ms_phd"
                  checked={isIntegratedMsPhd}
                  onCheckedChange={(checked) => {
                    // Update form value manually since Checkbox is not a native input
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
              // View mode: show as a labelled text value
              <div className="grid gap-1">
                <Label>석박사 통합과정</Label>
                <p className="text-sm">
                  {CURRENT_USER.is_integrated_ms_phd ? "예" : "아니오"}
                </p>
              </div>
            )}

            {/* Master's fields — only shown when is_integrated_ms_phd is false */}
            {!isIntegratedMsPhd && (
              <>
                {/* Master's graduation year */}
                <div className="grid gap-1">
                  <Label htmlFor="kaist_ms_year">석사 졸업 연도</Label>
                  {isEditing ? (
                    <Input
                      id="kaist_ms_year"
                      type="number"
                      {...register("kaist_ms_year")}
                    />
                  ) : (
                    <p className="text-sm">
                      {displayValue(CURRENT_USER.kaist_ms_year)}
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
                      {displayValue(CURRENT_USER.kaist_ms_major)}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* PhD graduation year */}
            <div className="grid gap-1">
              <Label htmlFor="kaist_phd_year">박사 졸업 연도</Label>
              {isEditing ? (
                <Input
                  id="kaist_phd_year"
                  type="number"
                  {...register("kaist_phd_year")}
                />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.kaist_phd_year)}
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
                  {displayValue(CURRENT_USER.kaist_phd_major)}
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
                <p className="text-sm">{displayValue(CURRENT_USER.company)}</p>
              )}
            </div>

            {/* Job title */}
            <div className="grid gap-1">
              <Label htmlFor="job_title">직책</Label>
              {isEditing ? (
                <Input id="job_title" {...register("job_title")} />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.job_title)}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Section 4: Payment handles ── */}
        <section className="rounded-lg border p-4">
          <h2 className="mb-4 font-semibold">납부 수단</h2>

          <div className="flex flex-col gap-4">
            {/* Venmo username */}
            <div className="grid gap-1">
              <Label htmlFor="venmo_handle">Venmo</Label>
              {isEditing ? (
                <Input
                  id="venmo_handle"
                  placeholder="@username"
                  {...register("venmo_handle")}
                />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.venmo_handle)}
                </p>
              )}
            </div>

            {/* Zelle identifier (phone number or email) */}
            <div className="grid gap-1">
              <Label htmlFor="zelle_handle">Zelle</Label>
              {isEditing ? (
                <Input
                  id="zelle_handle"
                  placeholder="phone or email"
                  {...register("zelle_handle")}
                />
              ) : (
                <p className="text-sm">
                  {displayValue(CURRENT_USER.zelle_handle)}
                </p>
              )}
            </div>
          </div>
        </section>
      </form>
    </div>
  );
}
