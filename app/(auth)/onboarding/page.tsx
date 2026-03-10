"use client";

/**
 * Onboarding page — multi-step sign-up wizard for first-time users.
 *
 * After Google OAuth login, new users (without a profile) are redirected here
 * to fill in their alumni information before gaining access to the app.
 *
 * Step 1: Basic info (name, display name, phone) — required
 * Step 2: KAIST academic history — optional
 * Step 3: Professional info + payment handles — optional
 *
 * Year fields (kaist_*_year) are managed as strings in the form to avoid the
 * NaN issue caused by HTML number inputs + zodResolver. They are converted to
 * numbers only at submit time.
 *
 * Phase 2 (Task 004): Dummy UI — form data is only logged to the console.
 * Phase 3 (Task 011): Will create a Supabase profile with role='pending'.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { onboardingSchema } from "@/lib/validations/onboarding";
import type { OnboardingFormData } from "@/lib/validations/onboarding";

/**
 * Internal form schema that mirrors onboardingSchema but uses strings for year
 * fields. This avoids the NaN problem with <input type="number"> + zodResolver,
 * where an empty input is coerced to NaN which fails z.number().optional().
 *
 * At submit time we transform string years into numbers before passing to
 * the real onboardingSchema validator.
 *
 * Note: is_integrated_ms_phd uses z.boolean() without .default() to keep the
 * TypeScript inferred type as `boolean` (not `boolean | undefined`). The
 * default value of `false` is provided via useForm's `defaultValues` instead.
 * Using z.boolean().default(false) causes a type mismatch between Zod 4's
 * input type (boolean | undefined) and React Hook Form's expected FieldValues.
 */
const formSchema = z.object({
  full_name: z.string().min(2, "이름은 2자 이상이어야 합니다"),
  display_name: z.string().min(2, "표시 이름은 2자 이상이어야 합니다"),
  phone: z.string().min(5, "연락처를 입력해주세요"),
  // Year fields stored as strings to keep inputs clean; converted at submit
  kaist_bs_year: z.string().optional(),
  kaist_bs_major: z.string().optional(),
  // No .default(false) here — see note above
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

// Map each step number to the form field names it contains.
// Used to trigger per-step validation before advancing to the next step.
const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ["full_name", "display_name", "phone"],
  2: [
    "kaist_bs_year",
    "kaist_bs_major",
    "is_integrated_ms_phd",
    "kaist_ms_year",
    "kaist_ms_major",
    "kaist_phd_year",
    "kaist_phd_major",
  ],
  3: ["company", "job_title", "venmo_handle", "zelle_handle"],
};

const TOTAL_STEPS = 3;

/**
 * Converts a string year value to a number, or returns undefined if empty.
 * Used when transforming the internal form data to the onboardingSchema shape.
 */
function parseYear(value: string | undefined): number | undefined {
  if (!value || value.trim() === "") return undefined;
  const num = parseInt(value, 10);
  return isNaN(num) ? undefined : num;
}

export default function OnboardingPage() {
  // Track which step the user is currently on (1-indexed)
  const [currentStep, setCurrentStep] = useState(1);

  // Single useForm instance for the entire multi-step form using the internal
  // string-based schema. Year values are converted to numbers at submit time.
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      display_name: "",
      phone: "",
      kaist_bs_year: "",
      kaist_bs_major: "",
      is_integrated_ms_phd: false,
      kaist_ms_year: "",
      kaist_ms_major: "",
      kaist_phd_year: "",
      kaist_phd_major: "",
      company: "",
      job_title: "",
      venmo_handle: "",
      zelle_handle: "",
    },
    mode: "onTouched",
  });

  // Watch the integrated MS/PhD checkbox to conditionally show MS fields
  const isIntegratedMsPhd = watch("is_integrated_ms_phd");

  /**
   * Validates only the fields belonging to the current step,
   * then advances to the next step if all are valid.
   */
  const handleNext = async () => {
    const valid = await trigger(
      STEP_FIELDS[currentStep] as (keyof FormValues)[],
    );
    if (valid) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  /** Goes back to the previous step without re-validating. */
  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  /**
   * Final form submission handler.
   *
   * Converts internal string-based year values to numbers and validates the
   * result against the canonical onboardingSchema before logging/submitting.
   *
   * Phase 2: logs data to console only.
   * Phase 3 (Task 011): will call a Server Action to create the Supabase profile.
   */
  const onSubmit = (data: FormValues) => {
    // Transform string year fields to numbers (or undefined if empty)
    const transformed: OnboardingFormData = {
      ...data,
      kaist_bs_year: parseYear(data.kaist_bs_year),
      kaist_ms_year: parseYear(data.kaist_ms_year),
      kaist_phd_year: parseYear(data.kaist_phd_year),
      // Ensure is_integrated_ms_phd is always a boolean (default(false) handles this)
      is_integrated_ms_phd: data.is_integrated_ms_phd ?? false,
    };

    // Validate against the canonical schema to catch any edge cases
    const result = onboardingSchema.safeParse(transformed);
    if (!result.success) {
      console.error("Onboarding validation error:", result.error);
      return;
    }

    console.log("Onboarding submitted (Phase 2 dummy):", result.data);
    // TODO Phase 3 (Task 011): create Supabase profile with role='pending'
  };

  // Calculate progress bar width based on current step
  const progressPercent = Math.round((currentStep / TOTAL_STEPS) * 100);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep} / {TOTAL_STEPS}
            </span>
            <span className="text-sm text-muted-foreground">
              {progressPercent}%
            </span>
          </div>
          {/* Simple progress bar using a div with dynamic width */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <Card>
          {/* Step titles and descriptions */}
          {currentStep === 1 && (
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
              <CardDescription>
                동문 확인을 위한 기본 정보를 입력해주세요.
              </CardDescription>
            </CardHeader>
          )}
          {currentStep === 2 && (
            <CardHeader>
              <CardTitle>KAIST 학력</CardTitle>
              <CardDescription>
                KAIST 재학 정보를 입력해주세요. 모든 항목은 선택 사항입니다.
              </CardDescription>
            </CardHeader>
          )}
          {currentStep === 3 && (
            <CardHeader>
              <CardTitle>직업 및 결제 정보</CardTitle>
              <CardDescription>
                현재 직업 및 결제 수단을 입력해주세요. 모든 항목은 선택
                사항입니다.
              </CardDescription>
            </CardHeader>
          )}

          <CardContent>
            {/* Wrap entire form in handleSubmit so Step 3's submit button works */}
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex flex-col gap-4">
                {/* ─── STEP 1: Basic info ─── */}
                {currentStep === 1 && (
                  <>
                    {/* Full legal name — required */}
                    <div className="grid gap-2">
                      <Label htmlFor="full_name">실명 *</Label>
                      <Input
                        id="full_name"
                        placeholder="홍길동"
                        {...register("full_name")}
                      />
                      {errors.full_name?.message && (
                        <p className="text-sm text-destructive">
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>

                    {/* Display name shown to other members — required */}
                    <div className="grid gap-2">
                      <Label htmlFor="display_name">표시 이름 *</Label>
                      <Input
                        id="display_name"
                        placeholder="길동"
                        {...register("display_name")}
                      />
                      {errors.display_name?.message && (
                        <p className="text-sm text-destructive">
                          {errors.display_name.message}
                        </p>
                      )}
                    </div>

                    {/* Contact phone number — required */}
                    <div className="grid gap-2">
                      <Label htmlFor="phone">연락처 *</Label>
                      <Input
                        id="phone"
                        placeholder="+1 (555) 000-0000"
                        {...register("phone")}
                      />
                      {errors.phone?.message && (
                        <p className="text-sm text-destructive">
                          {errors.phone.message}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* ─── STEP 2: KAIST academic history ─── */}
                {currentStep === 2 && (
                  <>
                    {/* Bachelor's graduation year */}
                    <div className="grid gap-2">
                      <Label htmlFor="kaist_bs_year">학사 졸업 연도</Label>
                      <Input
                        id="kaist_bs_year"
                        type="number"
                        placeholder="2010"
                        {...register("kaist_bs_year")}
                      />
                    </div>

                    {/* Bachelor's major */}
                    <div className="grid gap-2">
                      <Label htmlFor="kaist_bs_major">학사 전공</Label>
                      <Input
                        id="kaist_bs_major"
                        placeholder="컴퓨터공학"
                        {...register("kaist_bs_major")}
                      />
                    </div>

                    {/* Integrated MS/PhD checkbox — when checked, MS year/major fields are hidden */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="is_integrated_ms_phd"
                        checked={isIntegratedMsPhd}
                        onCheckedChange={(checked) => {
                          // Update form value manually since Checkbox is not a native input element
                          setValue("is_integrated_ms_phd", checked === true, {
                            shouldValidate: true,
                          });
                        }}
                      />
                      <Label
                        htmlFor="is_integrated_ms_phd"
                        className="cursor-pointer"
                      >
                        석·박사 통합과정
                      </Label>
                    </div>

                    {/* Master's fields — hidden when is_integrated_ms_phd is true */}
                    {!isIntegratedMsPhd && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="kaist_ms_year">석사 졸업 연도</Label>
                          <Input
                            id="kaist_ms_year"
                            type="number"
                            placeholder="2012"
                            {...register("kaist_ms_year")}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="kaist_ms_major">석사 전공</Label>
                          <Input
                            id="kaist_ms_major"
                            placeholder="컴퓨터공학"
                            {...register("kaist_ms_major")}
                          />
                        </div>
                      </>
                    )}

                    {/* PhD graduation year */}
                    <div className="grid gap-2">
                      <Label htmlFor="kaist_phd_year">박사 졸업 연도</Label>
                      <Input
                        id="kaist_phd_year"
                        type="number"
                        placeholder="2016"
                        {...register("kaist_phd_year")}
                      />
                    </div>

                    {/* PhD major */}
                    <div className="grid gap-2">
                      <Label htmlFor="kaist_phd_major">박사 전공</Label>
                      <Input
                        id="kaist_phd_major"
                        placeholder="컴퓨터공학"
                        {...register("kaist_phd_major")}
                      />
                    </div>
                  </>
                )}

                {/* ─── STEP 3: Professional info + payment handles ─── */}
                {currentStep === 3 && (
                  <>
                    {/* Current employer */}
                    <div className="grid gap-2">
                      <Label htmlFor="company">회사명</Label>
                      <Input
                        id="company"
                        placeholder="Google"
                        {...register("company")}
                      />
                    </div>

                    {/* Job title */}
                    <div className="grid gap-2">
                      <Label htmlFor="job_title">직책</Label>
                      <Input
                        id="job_title"
                        placeholder="Software Engineer"
                        {...register("job_title")}
                      />
                    </div>

                    {/* Venmo username for payments */}
                    <div className="grid gap-2">
                      <Label htmlFor="venmo_handle">Venmo 핸들</Label>
                      <Input
                        id="venmo_handle"
                        placeholder="@username"
                        {...register("venmo_handle")}
                      />
                    </div>

                    {/* Zelle identifier (phone or email) */}
                    <div className="grid gap-2">
                      <Label htmlFor="zelle_handle">Zelle 핸들</Label>
                      <Input
                        id="zelle_handle"
                        placeholder="phone or email"
                        {...register("zelle_handle")}
                      />
                    </div>
                  </>
                )}

                {/* ─── Navigation buttons ─── */}
                <div className="mt-2 flex gap-3">
                  {/* Back button — shown on Step 2 and 3 */}
                  {currentStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={handleBack}
                    >
                      이전
                    </Button>
                  )}

                  {/* Next button — shown on Step 1 and 2 */}
                  {currentStep < TOTAL_STEPS && (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleNext}
                    >
                      다음
                    </Button>
                  )}

                  {/* Submit button — shown only on Step 3 */}
                  {currentStep === TOTAL_STEPS && (
                    <Button type="submit" className="flex-1">
                      제출
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
