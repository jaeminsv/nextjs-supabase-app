# Event Form Enhancements — Design Spec

**Date:** 2026-03-23
**Status:** Approved

---

## Overview

Four enhancements to the event creation and editing flow:

1. Rich text editor for the **description** field (images + links)
2. Google Maps link button for the **location** field
3. **Delete event** option in edit mode (hard delete, organizer + admin)
4. Rich text editor for the **payment instructions** field (images + links)

---

## 1. Rich Text Editor (Description + Payment Instructions)

### Library

**Tiptap** (`@tiptap/react`, `@tiptap/starter-kit`)

Chosen because:

- First-class React/Next.js integration
- Composable Extension system (image upload, link, clipboard paste)
- Outputs clean HTML — straightforward to store and render
- Fits naturally with the shadcn/ui + Tailwind aesthetic

### Extensions Required

| Extension                 | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `@tiptap/starter-kit`     | Bold, italic, headings, lists, paragraph         |
| `@tiptap/extension-link`  | Clickable hyperlinks with URL input dialog       |
| `@tiptap/extension-image` | Image node (URL-based insertion)                 |
| Custom upload handler     | Clipboard paste + file picker → Supabase Storage |

### Storage Format

- Content stored as **HTML string** in the existing `description` and `payment_instructions` DB columns (type: `text`). No schema migration needed.
- Existing plain-text data renders correctly as-is (browsers treat untagged text as valid HTML content).

### Image Upload Flow

1. User pastes image from clipboard **or** clicks the image toolbar button and picks a file
2. Client validates: max 5MB, allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
3. File is uploaded to Supabase Storage bucket `event-images` with path `<userId>/<timestamp>-<filename>`
4. On upload error, display toast: "이미지 업로드에 실패했습니다. 파일 크기(최대 5MB)와 형식을 확인해주세요."
5. On success, public URL is returned and inserted as an `<img>` node in the editor
6. On form submit, the HTML (including the hosted image URLs) is saved to the DB
7. Orphaned images (from deleted events) are not cleaned up automatically — acceptable trade-off for MVP

### Toolbar Buttons (both fields)

Bold · Italic · Link · Image Upload (file picker) · Image URL (text input) · Divider

Payment instructions toolbar is identical to the description toolbar.

### Component Interface

A shared `RichTextEditor` component (`components/rich-text-editor.tsx`):

```typescript
interface RichTextEditorProps {
  value: string; // Current HTML content
  onChange: (html: string) => void; // Fires on every editor keystroke
  placeholder?: string;
  error?: string; // Displays error message below editor
}
```

- Integrates with React Hook Form via `Controller` (not `register`) because Tiptap is uncontrolled internally
- `onChange` fires on every change (not on blur) to keep RHF's form state in sync
- Renders error message with `text-sm text-destructive` below the editor border when `error` is set

### Rendering (Event Detail Page)

The stored HTML is rendered with `dangerouslySetInnerHTML` inside a `div` with Tailwind `prose` class (requires `@tailwindcss/typography` plugin). Output is sanitized client-side using **DOMPurify** before rendering to prevent XSS.

```tsx
<div
  className="prose prose-sm max-w-none"
  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(description) }}
/>
```

### Dependencies to Install

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-image dompurify
npm install --save-dev @types/dompurify
npm install @tailwindcss/typography
```

---

## 2. Google Maps Link Button (Location Field)

### Behaviour

- A **"구글 맵에서 보기 →"** link appears **below** the location input field.
- Rendered only when `watch("location")` is non-empty (fires on every keystroke, no debounce needed).
- Clicking opens `https://maps.google.com/?q=<encodeURIComponent(location)>` in a new tab (`target="_blank" rel="noopener noreferrer"`).
- No API key required — uses a standard Google Maps search URL.

### Styling

```tsx
<a
  href={`https://maps.google.com/?q=${encodeURIComponent(location)}`}
  target="_blank"
  rel="noopener noreferrer"
  className="text-sm text-primary underline hover:opacity-80"
>
  구글 맵에서 보기 →
</a>
```

---

## 3. Delete Event (Edit Mode)

### Access Control

Visibility condition (client-side): `mode === "edit" && (isAdmin || isOrganizer)`

- `isAdmin` — existing boolean prop already passed to `EventForm`
- `isOrganizer` — **new** boolean prop. Computed in `app/(main)/events/[id]/edit/page.tsx` by checking whether `userId` is present in the `organizers` array returned by `getEventById`. Example: `const isOrganizer = organizers.some(o => o.user_id === userId)`

Server Action also enforces this check independently (defense in depth).

### UI

- A **"이벤트 삭제"** button using the `destructive` variant is placed at the bottom of the form, below a `<hr>` separator.
- `AlertDialog` component is required — install with: `npx shadcn@latest add alert-dialog`
- Dialog content:
  - **Title:** "이벤트를 삭제하시겠습니까?"
  - **Body:** "이 작업은 되돌릴 수 없습니다. RSVP 데이터를 포함한 모든 이벤트 정보가 영구적으로 삭제됩니다."
  - **Cancel button:** "취소" (variant: `outline`)
  - **Confirm button:** "삭제" (variant: `destructive`) — disabled while deletion is in flight

### Server Action

New `deleteEvent(eventId: string)` in `actions/events.ts`:

```typescript
// Pseudo-code
export async function deleteEvent(
  eventId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  // Check permission: must be admin or event organizer
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";
  const { data: organizer } = await supabase
    .from("event_organizers")
    .select("user_id")
    .eq("event_id", eventId)
    .eq("user_id", user.id)
    .single();
  const isOrganizer = !!organizer;

  if (!isAdmin && !isOrganizer)
    return { error: "이벤트를 삭제할 권한이 없습니다." };

  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) return { error: "이벤트 삭제에 실패했습니다." };

  // Cascade handled by DB FK constraints (RSVPs, event_organizers)
  redirect("/events");
}
```

---

## 4. Supabase Storage Bucket

A new public bucket `event-images` is required. Configure in Supabase Dashboard → Storage:

- **Bucket name:** `event-images`
- **Public:** yes (URLs accessible without auth token)
- **RLS policies:**

```sql
-- Public read (SELECT)
CREATE POLICY "Public read event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Authenticated write (INSERT)
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');
```

- **File path convention:** `<userId>/<timestamp>-<sanitized-filename>` (prevents collisions)

### Storage Helper

New `lib/supabase/storage.ts`:

```typescript
// Returns public URL on success, throws Error on failure
export async function uploadEventImage(
  file: File,
  userId: string,
): Promise<string>;
```

---

## Affected Files

| File                                   | Change                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/rich-text-editor.tsx`      | **New** — shared Tiptap WYSIWYG editor                                                                                                                      |
| `components/event-form.tsx`            | Replace Textarea with RichTextEditor for description + payment_instructions; add location map link; add delete button + AlertDialog; add `isOrganizer` prop |
| `components/event-detail-client.tsx`   | Render description + payment_instructions as sanitized HTML (prose)                                                                                         |
| `actions/events.ts`                    | Add `deleteEvent` Server Action with server-side auth check                                                                                                 |
| `app/(main)/events/[id]/edit/page.tsx` | Compute and pass `isOrganizer` prop to EventForm                                                                                                            |
| `lib/supabase/storage.ts`              | **New** — `uploadEventImage(file, userId)` helper                                                                                                           |
| `tailwind.config.ts`                   | Add `@tailwindcss/typography` plugin                                                                                                                        |
| Supabase Dashboard                     | Create `event-images` bucket + RLS policies                                                                                                                 |

---

## Out of Scope

- Image resize handles in the editor
- Image caption / alt text
- Draft auto-save
- Soft delete / event restore
- Markdown mode
- Cleanup of orphaned images on event delete
