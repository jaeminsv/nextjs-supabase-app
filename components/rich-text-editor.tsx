"use client";

/**
 * RichTextEditor — Tiptap-based WYSIWYG editor for event forms.
 *
 * Features:
 * - Bold, italic, heading, paragraph formatting (via StarterKit)
 * - Hyperlink insertion with URL prompt
 * - Image insertion via URL prompt, file picker, or clipboard paste
 * - Image uploads are sent to Supabase Storage via uploadEventImage()
 * - Integrates with React Hook Form via the Controller pattern (not register)
 *
 * Usage with React Hook Form:
 *   <Controller
 *     name="description"
 *     control={control}
 *     render={({ field }) => (
 *       <RichTextEditor
 *         value={field.value ?? ''}
 *         onChange={field.onChange}
 *         placeholder="이벤트 설명을 입력하세요"
 *       />
 *     )}
 *   />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Button } from "@/components/ui/button";
import { uploadEventImage } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/client";

// ─── Props ────────────────────────────────────────────────────────────────────

interface RichTextEditorProps {
  // Current HTML content (controlled from React Hook Form via Controller)
  value: string;
  // Called on every editor change to keep RHF form state in sync
  onChange: (html: string) => void;
  // Optional placeholder text shown when editor is empty
  placeholder?: string;
  // Optional error message displayed below the editor
  error?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  error,
}: RichTextEditorProps) {
  // Tracks whether an image upload is in progress (disables upload buttons)
  const [isUploading, setIsUploading] = useState(false);
  // Holds upload-specific error messages shown below the editor
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Hidden file input ref — triggered programmatically by the "이미지 업로드" button
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize the Tiptap editor with required extensions
  const editor = useEditor({
    extensions: [
      // StarterKit includes: Bold, Italic, Heading, Paragraph, BulletList, OrderedList, etc.
      StarterKit,
      // Link extension: openOnClick=false so links don't navigate away while editing
      Link.configure({ openOnClick: false }),
      // Image extension: allows inserting <img> nodes via setImage command
      Image,
    ],
    // Set initial content from the controlled value prop
    content: value,
    // Fire onChange on every editor update to keep React Hook Form in sync
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    // Tiptap editor styles applied via editorProps
    editorProps: {
      attributes: {
        // prose classes apply Tailwind Typography styles; focus:outline-none removes default browser outline
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2",
      },
    },
  });

  // Sync external value changes back to editor (e.g. form reset, defaultValues load)
  // Only update when the editor content differs from the incoming value to avoid cursor jumps
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // ─── Image Upload Helper ────────────────────────────────────────────────────

  /**
   * Uploads a File object to Supabase Storage and inserts the resulting
   * public URL as an <img> node at the current editor cursor position.
   *
   * @param file - The image File from a file picker or clipboard paste
   */
  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;

      setIsUploading(true);
      setUploadError(null);

      try {
        // Retrieve the current user's ID for the storage path prefix
        const supabase = createClient();
        const { data: claimsData } = await supabase.auth.getClaims();
        const userId = claimsData?.claims?.sub ?? "anonymous";

        // Upload the image and get back a public URL
        const publicUrl = await uploadEventImage(file, userId);

        // Insert the image node at the current cursor position
        editor.chain().focus().setImage({ src: publicUrl }).run();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.";
        setUploadError(message);
      } finally {
        setIsUploading(false);
      }
    },
    [editor],
  );

  // ─── Toolbar Handlers ───────────────────────────────────────────────────────

  /** Prompt the user for a URL and insert a hyperlink at the current selection */
  const handleLinkInsert = () => {
    if (!editor) return;
    const url = prompt("링크 URL을 입력하세요:", "https://");
    if (!url) return;
    editor.chain().focus().setLink({ href: url }).run();
  };

  /** Prompt the user for an image URL and insert it as an <img> node */
  const handleImageUrl = () => {
    if (!editor) return;
    const url = prompt("이미지 URL을 입력하세요:", "https://");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  /** Trigger the hidden file input to open the OS file picker */
  const handleFilePickerClick = () => {
    fileInputRef.current?.click();
  };

  /** Called when the user selects a file via the file picker */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleImageUpload(file);
    // Reset the file input so the same file can be re-selected if needed
    e.target.value = "";
  };

  /** Handle image paste from clipboard (e.g. screenshot, copy-paste from browser) */
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = Array.from(e.clipboardData.items);
      // Find the first image item in the clipboard data
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;

      // Prevent Tiptap's default paste handling for images
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      await handleImageUpload(file);
    },
    [handleImageUpload],
  );

  // Guard: Tiptap returns null during SSR — render nothing until hydrated
  if (!editor) return null;

  return (
    <div className="space-y-1">
      {/* ─── Toolbar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 rounded-t-md border border-b-0 bg-muted/30 p-1">
        {/* Bold toggle */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("bold") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="h-7 px-2 text-xs"
        >
          B
        </Button>

        {/* Italic toggle */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("italic") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className="h-7 px-2 text-xs italic"
        >
          I
        </Button>

        {/* Link insertion */}
        <Button
          type="button"
          size="sm"
          variant={editor.isActive("link") ? "default" : "outline"}
          onClick={handleLinkInsert}
          className="h-7 px-2 text-xs"
        >
          링크
        </Button>

        {/* Divider */}
        <div className="mx-1 h-7 w-px bg-border" />

        {/* Image upload via file picker */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleFilePickerClick}
          disabled={isUploading}
          className="h-7 px-2 text-xs"
        >
          {isUploading ? "업로드 중..." : "이미지 업로드"}
        </Button>

        {/* Image insertion via URL */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleImageUrl}
          disabled={isUploading}
          className="h-7 px-2 text-xs"
        >
          이미지 URL
        </Button>

        {/* Hidden file input — triggered by the "이미지 업로드" button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* ─── Editor Content Area ─────────────────────────────────────────── */}
      <div
        className="rounded-b-md border"
        onPaste={handlePaste}
        data-placeholder={placeholder}
      >
        <EditorContent editor={editor} />
      </div>

      {/* ─── Error Messages ───────────────────────────────────────────────── */}
      {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
