"use client";

/**
 * RichTextEditor — Tiptap-based WYSIWYG editor for event forms.
 *
 * Features:
 * - Bold, italic, heading, paragraph formatting (via StarterKit)
 * - Text color selection (via Color + TextStyle extensions)
 * - Font size selection (via custom FontSize extension based on TextStyle)
 * - Hyperlink auto-detection (autolink enabled; manual link button removed)
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

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Extension } from "@tiptap/core";
import { Button } from "@/components/ui/button";
import { uploadEventImage } from "@/lib/supabase/storage";
import { createClient } from "@/lib/supabase/client";

// ─── Custom FontSize Extension ─────────────────────────────────────────────────
// Tiptap does not ship a first-party font-size package for v3.x, so we build
// a lightweight extension on top of TextStyle that stores fontSize as an inline
// CSS style attribute (e.g. style="font-size: 18px").

const FontSize = Extension.create({
  name: "fontSize",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        // Attach the fontSize attribute to textStyle marks
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            // Render as inline CSS when the editor outputs HTML
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
            // Parse the inline style back to the attribute when loading HTML
            parseHTML: (element) => element.style.fontSize || null,
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      // setFontSize applies the given size string (e.g. "18px") to the selection
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark("textStyle", { fontSize }).run();
        },
      // unsetFontSize removes the fontSize attribute from the selection
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain()
            .setMark("textStyle", { fontSize: null })
            .removeEmptyTextStyle()
            .run();
        },
    };
  },
});

// ─── Font size options shown in the toolbar dropdown ───────────────────────────
const FONT_SIZE_OPTIONS = [
  { label: "12px", value: "12px" },
  { label: "14px", value: "14px" },
  { label: "16px", value: "16px" },
  { label: "18px", value: "18px" },
  { label: "20px", value: "20px" },
  { label: "24px", value: "24px" },
  { label: "32px", value: "32px" },
];

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

// Extend the Tiptap Commands interface so TypeScript knows about our custom commands
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  error,
}: RichTextEditorProps) {
  // Generate a unique ID for the color picker label/input pair.
  // This prevents ID collisions when multiple RichTextEditor instances are
  // rendered on the same page (e.g., description + payment_instructions).
  const colorPickerId = useId();

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
      // Link extension: autolink=true auto-detects URLs as links; openOnClick=false
      // prevents navigation while editing. The manual "링크" button has been removed
      // since URLs are automatically converted to clickable links.
      Link.configure({ openOnClick: false, autolink: true }),
      // Image extension: allows inserting <img> nodes via setImage command
      Image,
      // TextStyle: base mark required by Color and FontSize extensions
      TextStyle,
      // Color: adds setColor / unsetColor commands that apply color via TextStyle
      Color,
      // FontSize: custom extension (defined above) for changing font size
      FontSize,
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

  // Read the current text color from the editor selection (falls back to black)
  const currentColor =
    (editor.getAttributes("textStyle").color as string | undefined) ??
    "#000000";

  // Read the current font size from the editor selection (falls back to empty = default)
  const currentFontSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

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

        {/* Divider */}
        <div className="mx-1 h-7 w-px bg-border" />

        {/* Text color picker — native color input styled to match toolbar buttons */}
        <div className="flex items-center gap-1">
          <label
            htmlFor={colorPickerId}
            className="flex h-7 cursor-pointer items-center rounded border border-input bg-background px-2 text-xs hover:bg-accent"
            title="글자 색상"
          >
            {/* "A" with a colored underline to indicate the current color */}
            <span style={{ borderBottom: `3px solid ${currentColor}` }}>A</span>
          </label>
          <input
            id={colorPickerId}
            type="color"
            value={currentColor}
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
            className="sr-only"
          />
        </div>

        {/* Font size selector dropdown */}
        <select
          value={currentFontSize}
          onChange={(e) => {
            const size = e.target.value;
            if (size) {
              editor.chain().focus().setFontSize(size).run();
            } else {
              editor.chain().focus().unsetFontSize().run();
            }
          }}
          className="h-7 rounded border border-input bg-background px-1 text-xs focus:outline-none"
          title="글자 크기"
        >
          <option value="">크기</option>
          {FONT_SIZE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

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
