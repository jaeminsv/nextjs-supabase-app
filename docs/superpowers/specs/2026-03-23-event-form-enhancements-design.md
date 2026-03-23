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

| Extension                                 | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `@tiptap/starter-kit`                     | Bold, italic, headings, lists, code, paragraph   |
| `@tiptap/extension-link`                  | Clickable hyperlinks with URL input dialog       |
| `@tiptap/extension-image`                 | Image node (URL-based insertion)                 |
| `tiptap-extension-resize-image` or custom | Optional: image resize handles                   |
| Custom upload handler                     | Clipboard paste + file picker → Supabase Storage |

### Storage Format

- Content stored as **HTML string** in the existing `description` and `payment_instructions` DB columns (type: `text`). No schema migration needed.
- Existing plain-text data renders correctly as-is (browsers treat untagged text as valid HTML content).

### Image Upload Flow

1. User pastes image from clipboard **or** clicks the image toolbar button and picks a file
2. File is uploaded to Supabase Storage bucket `event-images` (public read, authenticated write)
3. Public URL is returned and inserted as an `<img>` node in the editor
4. On form submit, the HTML (including the hosted image URLs) is saved to the DB

### Toolbar Buttons (both fields)

Bold · Italic · Link · Image Upload · Image URL · Divider

Payment instructions toolbar is identical to the description toolbar.

### Component

A shared `RichTextEditor` component (`components/rich-text-editor.tsx`) accepts:

- `value: string` — current HTML content
- `onChange: (html: string) => void` — called on every editor change
- `placeholder?: string`

This component replaces the `<Textarea>` in `EventForm` for both the `description` and `payment_instructions` fields. Because `RichTextEditor` is an uncontrolled-to-controlled bridge, `react-hook-form`'s `Controller` wrapper is used instead of `register`.

### Rendering (Event Detail Page)

The stored HTML is rendered using `dangerouslySetInnerHTML` inside a `prose` class container (Tailwind Typography plugin) so links are clickable and images display correctly.

---

## 2. Google Maps Link Button (Location Field)

### Behaviour

- A **"구글 맵에서 보기 →"** link appears **below** the location input field.
- The link is only rendered when the location input has a non-empty value.
- Clicking opens `https://maps.google.com/?q=<encoded location>` in a new tab.
- No API key required — uses a standard Google Maps search URL.

### Implementation

The location field in `EventForm` watches its own value via `watch("location")`. When non-empty, an anchor tag is rendered beneath the input.

---

## 3. Delete Event (Edit Mode)

### Access Control

The **Delete** button is shown only when **both** conditions are true:

- `mode === "edit"`
- The current user is an admin **or** is listed as an organizer for this event

`isAdmin` prop is already passed to `EventForm`. A new `isOrganizer` prop will be added.

### UI

- A **"이벤트 삭제"** button using the `destructive` variant is placed at the bottom of the form, separated from the other action buttons by a visual divider.
- Clicking opens an **AlertDialog** (shadcn/ui) with:
  - Title: "이벤트를 삭제하시겠습니까?"
  - Body: "이 작업은 되돌릴 수 없습니다. RSVP 데이터를 포함한 모든 이벤트 정보가 영구적으로 삭제됩니다."
  - Buttons: "취소" (outline) · "삭제" (destructive)

### Server Action

A new `deleteEvent(eventId)` Server Action in `actions/events.ts`:

- Verifies the caller is the event organizer or an admin (server-side check)
- Executes `DELETE FROM events WHERE id = $1` — cascades to RSVPs via FK constraint
- On success: redirects to `/events`

---

## 4. Supabase Storage Bucket

A new public bucket `event-images` is required:

- **Public read** (images embedded in HTML must be accessible without auth)
- **Authenticated write** (only logged-in users can upload)
- RLS policy: `INSERT` allowed for authenticated users; `SELECT` public

---

## Affected Files

| File                                   | Change                                                                                                                                                      |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/rich-text-editor.tsx`      | **New** — shared Tiptap editor component                                                                                                                    |
| `components/event-form.tsx`            | Replace Textarea with RichTextEditor for description + payment_instructions; add location map link; add delete button + AlertDialog; add `isOrganizer` prop |
| `components/event-detail-client.tsx`   | Render description + payment_instructions as HTML (prose)                                                                                                   |
| `actions/events.ts`                    | Add `deleteEvent` Server Action                                                                                                                             |
| `app/(main)/events/[id]/edit/page.tsx` | Pass `isOrganizer` prop to EventForm                                                                                                                        |
| `lib/supabase/storage.ts`              | **New** — helper to upload image to Supabase Storage                                                                                                        |
| Supabase Dashboard                     | Create `event-images` storage bucket + RLS policies                                                                                                         |

---

## Out of Scope

- Image resize handles in the editor
- Image caption support
- Draft auto-save
- Soft delete / event restore
- Markdown mode
