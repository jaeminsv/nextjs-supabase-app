"use client";

/**
 * EventForm — shared form component for creating and editing events.
 *
 * Used on both /events/new (create) and /events/[id]/edit (edit) pages.
 *
 * Internal form schema uses string types for all date/time and numeric fields
 * to avoid NaN/validation errors from HTML inputs + zodResolver.
 * Conversion to proper EventFormData types (ISO string, number) happens at submit time.
 *
 * Organizer management (adding/removing co-organizers) is available in edit mode
 * for admins. Uses searchMembers, addOrganizer, removeOrganizer Server Actions.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EventFormData } from "@/lib/validations/event";
import type { EventOrganizer } from "@/lib/types/event";
import {
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
  completeEvent,
} from "@/actions/events";
import {
  addOrganizer,
  removeOrganizer,
  searchMembers,
} from "@/actions/organizers";
import type { MemberSearchResult } from "@/actions/organizers";

// ─── Props ───────────────────────────────────────────────────────────────────

interface EventFormProps {
  // "create" shows empty form; "edit" pre-populates with defaultValues
  mode: "create" | "edit";
  // Optional pre-populated values (used in edit mode)
  defaultValues?: Partial<EventFormData>;
  // The ID of the event being edited (edit mode only)
  eventId?: string;
  // Current list of organizers for the event (edit mode only)
  initialOrganizers?: EventOrganizer[];
  // Whether the current user is an admin (controls organizer management visibility)
  isAdmin?: boolean;
  // Whether the current user is listed as an organizer for this event (controls delete button visibility)
  isOrganizer?: boolean;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a datetime-local string ("YYYY-MM-DDTHH:mm") to a full ISO 8601
 * string with seconds and UTC offset ("YYYY-MM-DDTHH:mm:00.000Z").
 * Returns undefined if the input is empty or falsy.
 */
function toIsoString(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // datetime-local strings lack seconds and timezone; append them for ISO compliance
  return new Date(value).toISOString();
}

/**
 * Converts the raw string-typed form values to the EventFormData shape
 * expected by the Server Actions (createEvent / updateEvent).
 */
function toEventFormData(data: FormValues): EventFormData {
  return {
    title: data.title,
    description: data.description || undefined,
    location: data.location,
    // Convert datetime-local string → full ISO timestamp
    start_at: toIsoString(data.start_at)!,
    end_at: toIsoString(data.end_at),
    rsvp_deadline: toIsoString(data.rsvp_deadline),
    // Convert string → number (parseFloat handles decimals; fallback to 0)
    fee_amount: parseFloat(data.fee_amount) || 0,
    adult_guest_fee: parseFloat(data.adult_guest_fee) || 0,
    child_guest_fee: parseFloat(data.child_guest_fee) || 0,
    payment_instructions: data.payment_instructions || undefined,
    // Convert string → integer, or undefined if empty
    max_capacity: data.max_capacity
      ? parseInt(data.max_capacity, 10)
      : undefined,
    status: data.status,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EventForm({
  mode,
  defaultValues,
  eventId,
  initialOrganizers = [],
  isAdmin = false,
}: EventFormProps) {
  const router = useRouter();

  // Track whether a server action is in flight to disable buttons during submission
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Store server-side error messages for display below the action buttons
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Organizer management state ──────────────────────────────────────────

  // Current list of organizers for this event (starts with server-fetched data)
  const [organizers, setOrganizers] =
    useState<EventOrganizer[]>(initialOrganizers);

  // Text typed in the member search input
  const [searchQuery, setSearchQuery] = useState("");

  // Results returned by searchMembers Server Action
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);

  // True while searchMembers is running (shows loading indicator in dropdown)
  const [isSearching, setIsSearching] = useState(false);

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

  // Watch the status field to conditionally render status-transition buttons
  const currentStatus = watch("status");

  // Controls the description field tab: "edit" shows textarea, "preview" shows rendered text
  const [descriptionTab, setDescriptionTab] = useState<"edit" | "preview">(
    "edit",
  );

  /**
   * Handles the main save/create form submission.
   * Converts internal string form values to EventFormData types, then calls
   * the appropriate Server Action based on the current mode.
   */
  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const eventData = toEventFormData(data);

    if (mode === "create") {
      // Create a new event as draft, then navigate to its detail page
      const result = await createEvent(eventData);
      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }
      // Navigate to the newly created event's detail page
      router.push(`/events/${result.eventId}`);
    } else {
      // Update the existing event fields
      if (!eventId) {
        setErrorMessage("이벤트 ID가 없습니다.");
        setIsSubmitting(false);
        return;
      }
      const result = await updateEvent(eventId, eventData);
      if (result.error) {
        setErrorMessage(result.error);
        setIsSubmitting(false);
        return;
      }
      router.push(`/events/${eventId}`);
    }

    setIsSubmitting(false);
  };

  /**
   * Handles status transition actions (publish, cancel, complete).
   * First saves the current form field values, then transitions the status.
   * Called directly from button onClick — not from handleSubmit — because
   * status changes are separate from field edits.
   */
  const handleStatusAction = async (
    action: "publish" | "cancel" | "complete",
  ) => {
    if (!eventId) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    let result: { success?: true; error?: string };

    if (action === "publish") {
      result = await publishEvent(eventId);
    } else if (action === "cancel") {
      result = await cancelEvent(eventId);
    } else {
      result = await completeEvent(eventId);
    }

    if (result.error) {
      setErrorMessage(result.error);
      setIsSubmitting(false);
      return;
    }

    // Refresh the current page so the updated status is reflected
    router.push(`/events/${eventId}`);
  };

  // ─── Organizer management handlers ───────────────────────────────────────

  /**
   * Called when the user types in the member search input.
   * Fires the searchMembers Server Action and updates the dropdown results.
   * No debounce — fires on every keystroke for simplicity.
   *
   * @param query - The current value of the search input
   */
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      // Clear results when the input is empty so the dropdown disappears
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results = await searchMembers(query);
    // Filter out members who are already organizers to avoid duplicate adds
    const currentUserIds = new Set(organizers.map((o) => o.user_id));
    setSearchResults(results.filter((r) => !currentUserIds.has(r.id)));
    setIsSearching(false);
  };

  /**
   * Adds the selected member as an organizer by calling the Server Action,
   * then optimistically updates local organizers state and clears the search.
   *
   * @param member - The search result item that was clicked
   */
  const handleAddOrganizer = async (member: MemberSearchResult) => {
    if (!eventId) return;
    const result = await addOrganizer(eventId, member.id);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    // Optimistically add to local state so the UI updates without a page reload
    setOrganizers((prev) => [
      ...prev,
      {
        event_id: eventId,
        user_id: member.id,
        profile: {
          id: member.id,
          display_name: member.display_name,
          full_name: member.full_name,
        },
      },
    ]);
    // Clear search state after a successful add
    setSearchQuery("");
    setSearchResults([]);
  };

  /**
   * Removes a member from the organizer list by calling the Server Action,
   * then updates local state to hide the removed organizer immediately.
   *
   * @param userId - The user_id of the organizer to remove
   */
  const handleRemoveOrganizer = async (userId: string) => {
    if (!eventId) return;
    const result = await removeOrganizer(eventId, userId);
    if (result.error) {
      setErrorMessage(result.error);
      return;
    }
    // Optimistically remove from local state
    setOrganizers((prev) => prev.filter((o) => o.user_id !== userId));
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

      {/* ─── Organizer Management Section ────────────────────────────────────── */}
      {/* Only visible to admins in edit mode — organizers are set after event creation */}
      {isAdmin && mode === "edit" && (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">주최자 관리</h2>

          {/* Current organizer list — each chip has an X button to remove */}
          {organizers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {organizers.map((organizer) => (
                <div
                  key={organizer.user_id}
                  className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                >
                  <span>{organizer.profile.display_name}</span>
                  {/* Remove button — calls removeOrganizer Server Action */}
                  <button
                    type="button"
                    className="ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => handleRemoveOrganizer(organizer.user_id)}
                    aria-label={`${organizer.profile.display_name} 제거`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Member search — type to find approved members by name */}
          <div className="relative">
            <Input
              placeholder="회원 이름으로 검색..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />

            {/* Search results dropdown — shown when there are results or a search is running */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                {isSearching ? (
                  // Loading indicator while the Server Action is in flight
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    검색 중...
                  </div>
                ) : (
                  searchResults.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => handleAddOrganizer(member)}
                    >
                      <span className="font-medium">{member.display_name}</span>
                      <span className="text-muted-foreground">
                        ({member.full_name})
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            승인된 회원 중 이름으로 검색하여 주최자로 추가할 수 있습니다.
          </p>
        </section>
      )}

      {/* ─── Server-side Error Message ───────────────────────────────────────── */}
      {errorMessage && (
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      {/* ─── Action Buttons ───────────────────────────────────────────── */}
      <div className="space-y-2">
        {mode === "create" ? (
          /* Create mode: submit the form to save as draft */
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : "초안 저장"}
          </Button>
        ) : (
          /* Edit mode: action buttons depend on current event status */
          <>
            {/* Save updated field values without changing status */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "저장 중..." : "저장"}
            </Button>

            {/* Draft → Published: make the event visible to members */}
            {currentStatus === "draft" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => handleStatusAction("publish")}
              >
                게시하기
              </Button>
            )}

            {/* Published → Cancelled: cancel without hard-deleting */}
            {currentStatus === "published" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => handleStatusAction("cancel")}
              >
                이벤트 취소
              </Button>
            )}

            {/* Published → Completed: mark the event as done */}
            {currentStatus === "published" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={isSubmitting}
                onClick={() => handleStatusAction("complete")}
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
