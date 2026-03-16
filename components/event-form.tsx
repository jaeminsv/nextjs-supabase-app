"use client";

/**
 * EventForm — shared form component for creating and editing events.
 *
 * Used on both /events/new (create) and /events/[id]/edit (edit) pages.
 *
 * Sections rendered in this task (Task 007-1):
 *   - Basic Info: title, description, location
 *   - Schedule: start_at, end_at, rsvp_deadline
 *
 * Sections deferred to Task 007-2:
 *   - Fees: fee_amount, adult_guest_fee, child_guest_fee, payment_instructions
 *   - Settings: max_capacity, status
 *   - Action buttons (save draft / publish)
 *
 * Internal form schema uses string types for all date/time and numeric fields
 * to avoid NaN issues caused by HTML inputs + zodResolver (see onboarding page).
 * Conversion to proper types will happen at submit time in Phase 3 (Task 015).
 *
 * Phase 2: form data is only logged to the console.
 * Phase 3 (Task 015): will call createEvent / updateEvent server actions.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventFormData } from "@/lib/validations/event";
import { CURRENT_USER, ALL_PROFILES } from "@/lib/dummy-data";

// ─── Props ───────────────────────────────────────────────────────────────────

interface EventFormProps {
  // "create" shows empty form; "edit" pre-populates with defaultValues
  mode: "create" | "edit";
  // Optional pre-populated values (used in edit mode)
  defaultValues?: Partial<EventFormData>;
  // The ID of the event being edited (edit mode only)
  eventId?: string;
}

// ─── Internal form schema ─────────────────────────────────────────────────────

/**
 * All date/time and numeric fields are stored as strings inside the form to
 * prevent NaN/validation errors from HTML inputs + zodResolver.
 *
 * - datetime-local inputs return "YYYY-MM-DDTHH:mm" strings, not ISO timestamps
 * - number inputs return NaN when empty, which breaks z.number().optional()
 *
 * Conversion to proper types (ISO string, number) happens at submit time.
 */
const formSchema = z.object({
  // Basic info
  title: z
    .string()
    .min(2, "제목은 2자 이상이어야 합니다")
    .max(100, "제목은 100자 이하여야 합니다"),
  description: z.string().optional(),
  location: z.string().min(2, "장소를 입력해주세요"),

  // Schedule — stored as datetime-local strings ("YYYY-MM-DDTHH:mm")
  start_at: z.string().min(1, "시작 날짜를 입력해주세요"),
  end_at: z.string().optional(),
  rsvp_deadline: z.string().optional(),

  // Fees — stored as strings to avoid NaN from empty number inputs
  fee_amount: z.string(),
  adult_guest_fee: z.string(),
  child_guest_fee: z.string(),
  payment_instructions: z.string().optional(),

  // Settings
  max_capacity: z.string().optional(),
  status: z.enum(["draft", "published", "cancelled", "completed"]),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function EventForm({ mode, defaultValues }: EventFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      // Basic info
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      location: defaultValues?.location ?? "",

      // Schedule: ISO strings are sliced to "YYYY-MM-DDTHH:mm" for datetime-local inputs
      start_at: defaultValues?.start_at?.slice(0, 16) ?? "",
      end_at: defaultValues?.end_at?.slice(0, 16) ?? "",
      rsvp_deadline: defaultValues?.rsvp_deadline?.slice(0, 16) ?? "",

      // Fees: converted to strings so empty inputs don't produce NaN
      fee_amount: String(defaultValues?.fee_amount ?? 0),
      adult_guest_fee: String(defaultValues?.adult_guest_fee ?? 0),
      child_guest_fee: String(defaultValues?.child_guest_fee ?? 0),
      payment_instructions: defaultValues?.payment_instructions ?? "",

      // Settings
      max_capacity: defaultValues?.max_capacity
        ? String(defaultValues.max_capacity)
        : "",
      // Create mode always starts as draft; edit mode preserves current status
      status: mode === "create" ? "draft" : (defaultValues?.status ?? "draft"),
    },
  });

  // Check if current user is an admin (Phase 2: always false since CURRENT_USER is 'member')
  const isAdmin = CURRENT_USER.role === "admin";

  // Track selected organizer profile IDs
  // Initialize with the event creator as default organizer in edit mode
  const [organizerIds, setOrganizerIds] = useState<string[]>(
    (defaultValues as { created_by?: string })?.created_by
      ? [(defaultValues as { created_by?: string }).created_by!]
      : [],
  );

  // Toggle organizer selection — add if not present, remove if already selected
  const toggleOrganizer = (id: string) => {
    setOrganizerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Controls the description field tab: "edit" shows textarea, "preview" shows rendered text
  const [descriptionTab, setDescriptionTab] = useState<"edit" | "preview">(
    "edit",
  );

  // Watch the status field to conditionally render action buttons
  const currentStatus = watch("status");

  /**
   * Form submit handler.
   * Phase 2: logs form data to console only.
   * Phase 3 (Task 015): will call createEvent or updateEvent server action.
   */
  const onSubmit = (data: FormValues) => {
    console.log("submit:", data);
    // TODO Phase 3 (Task 015): call createEvent / updateEvent server action
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* ─── Basic Info Section ─────────────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">기본 정보</h2>

        {/* Event title — required (2–100 chars) */}
        <div className="space-y-1">
          <Label htmlFor="title">제목 *</Label>
          <Input id="title" {...register("title")} placeholder="이벤트 제목" />
          {errors.title && (
            <p className="text-sm text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Event description — optional plain text with edit/preview tab toggle */}
        <div className="space-y-1">
          <Label>설명</Label>
          {/* Tab toggle buttons — type="button" prevents form submission */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={descriptionTab === "edit" ? "default" : "outline"}
              onClick={() => setDescriptionTab("edit")}
            >
              편집
            </Button>
            <Button
              type="button"
              size="sm"
              variant={descriptionTab === "preview" ? "default" : "outline"}
              onClick={() => setDescriptionTab("preview")}
            >
              미리보기
            </Button>
          </div>
          {descriptionTab === "edit" ? (
            <Textarea
              id="description"
              {...register("description")}
              placeholder="이벤트 설명을 입력하세요"
              rows={4}
            />
          ) : (
            /* Preview: display plain text with line breaks preserved */
            <div className="min-h-[100px] whitespace-pre-wrap rounded-md border p-2 text-sm">
              {watch("description") || "내용 없음"}
            </div>
          )}
        </div>

        {/* Venue / location — required (min 2 chars) */}
        <div className="space-y-1">
          <Label htmlFor="location">장소 *</Label>
          <Input
            id="location"
            {...register("location")}
            placeholder="이벤트 장소"
          />
          {errors.location && (
            <p className="text-sm text-destructive">
              {errors.location.message}
            </p>
          )}
        </div>
      </section>

      {/* ─── Schedule Section ───────────────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">일정</h2>

        {/* Start date/time — required */}
        <div className="space-y-1">
          <Label htmlFor="start_at">시작 날짜/시간 *</Label>
          <Input
            id="start_at"
            type="datetime-local"
            {...register("start_at")}
          />
          {errors.start_at && (
            <p className="text-sm text-destructive">
              {errors.start_at.message}
            </p>
          )}
        </div>

        {/* End date/time — optional */}
        <div className="space-y-1">
          <Label htmlFor="end_at">종료 날짜/시간 (선택)</Label>
          <Input id="end_at" type="datetime-local" {...register("end_at")} />
        </div>

        {/* RSVP deadline — optional */}
        <div className="space-y-1">
          <Label htmlFor="rsvp_deadline">RSVP 마감일 (선택)</Label>
          <Input
            id="rsvp_deadline"
            type="datetime-local"
            {...register("rsvp_deadline")}
          />
        </div>
      </section>

      {/* ─── Fee Section ─────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="text-base font-semibold">회비 설정</h2>

        {/* Member base fee — stored as string (see formSchema note) */}
        <div className="space-y-1">
          <Label htmlFor="fee_amount">회원 1인 요금 ($)</Label>
          <Input
            id="fee_amount"
            type="number"
            min="0"
            {...register("fee_amount")}
          />
        </div>

        {/* Adult guest fee */}
        <div className="space-y-1">
          <Label htmlFor="adult_guest_fee">성인 동반자 요금 ($)</Label>
          <Input
            id="adult_guest_fee"
            type="number"
            min="0"
            {...register("adult_guest_fee")}
          />
        </div>

        {/* Child guest fee — defaults to 0 (free) */}
        <div className="space-y-1">
          <Label htmlFor="child_guest_fee">아동 동반자 요금 ($)</Label>
          <Input
            id="child_guest_fee"
            type="number"
            min="0"
            {...register("child_guest_fee")}
          />
        </div>

        {/* Payment instructions — optional */}
        <div className="space-y-1">
          <Label htmlFor="payment_instructions">납부 안내 (선택)</Label>
          <Textarea
            id="payment_instructions"
            {...register("payment_instructions")}
            placeholder="예: Venmo @kaist-sv 로 송금해주세요"
            rows={2}
          />
        </div>

        {/* Max capacity — optional; empty means unlimited */}
        <div className="space-y-1">
          <Label htmlFor="max_capacity">최대 정원 (선택)</Label>
          <Input
            id="max_capacity"
            type="number"
            min="1"
            placeholder="무제한"
            {...register("max_capacity")}
          />
        </div>
      </section>

      {/* ─── Organizer Management Section (admin only) ─────────────────────────────── */}
      {/* Phase 3 TODO: replace with real event_organizers table queries */}
      {isAdmin && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">주최자 관리</h2>
          {/* List all non-pending profiles as organizer candidates */}
          {ALL_PROFILES.filter((p) => p.role !== "pending").map((profile) => (
            <div key={profile.id} className="flex items-center justify-between">
              <span className="text-sm">
                {profile.display_name}{" "}
                <span className="text-muted-foreground">({profile.role})</span>
              </span>
              {/* Toggle button: default variant = selected, outline = unselected */}
              <Button
                type="button"
                size="sm"
                variant={
                  organizerIds.includes(profile.id) ? "default" : "outline"
                }
                onClick={() => toggleOrganizer(profile.id)}
              >
                {organizerIds.includes(profile.id) ? "선택됨" : "선택"}
              </Button>
            </div>
          ))}
        </section>
      )}

      {/* ─── Action Buttons ───────────────────────────────────────────── */}
      {/* Phase 3 TODO: replace console.log with createEvent / updateEvent server action */}
      <div className="space-y-2">
        {mode === "create" ? (
          /* Create mode: save as draft */
          <Button
            type="button"
            className="w-full"
            onClick={handleSubmit((data) =>
              console.log("Action: save-draft", {
                ...data,
                status: "draft",
                organizerIds,
              }),
            )}
          >
            초안 저장
          </Button>
        ) : (
          /* Edit mode: action buttons depend on current event status */
          <>
            {/* Always show Save to update current fields */}
            <Button
              type="button"
              className="w-full"
              onClick={handleSubmit((data) =>
                console.log("Action: save", { ...data, organizerIds }),
              )}
            >
              저장
            </Button>

            {/* Draft → Published */}
            {currentStatus === "draft" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSubmit((data) =>
                  console.log("Action: publish", {
                    ...data,
                    status: "published",
                    organizerIds,
                  }),
                )}
              >
                게시하기
              </Button>
            )}

            {/* Published → Cancelled */}
            {currentStatus === "published" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSubmit((data) =>
                  console.log("Action: cancel", {
                    ...data,
                    status: "cancelled",
                    organizerIds,
                  }),
                )}
              >
                이벤트 취소
              </Button>
            )}

            {/* Published → Completed */}
            {currentStatus === "published" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSubmit((data) =>
                  console.log("Action: complete", {
                    ...data,
                    status: "completed",
                    organizerIds,
                  }),
                )}
              >
                완료 처리
              </Button>
            )}
          </>
        )}
      </div>
    </form>
  );
}
