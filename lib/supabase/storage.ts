"use client";

/**
 * Supabase Storage helpers for client-side image uploads.
 *
 * This module runs only in the browser (File API requirement).
 * Do NOT import this file in Server Components or Server Actions.
 *
 * Bucket: 'event-images' (public read, authenticated write)
 * File path convention: {userId}/{timestamp}-{filename}
 *
 * Required Supabase bucket setup (one-time, via Supabase dashboard):
 *   - Bucket name: event-images
 *   - Public: true
 *   - RLS policies:
 *       SELECT: USING (bucket_id = 'event-images')
 *       INSERT: TO authenticated WITH CHECK (bucket_id = 'event-images')
 */

import { createClient } from "@/lib/supabase/client";

// Maximum allowed image file size: 5MB in bytes
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed MIME types for image uploads
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Uploads an image file to the 'event-images' Supabase Storage bucket.
 *
 * Validates file size and type before uploading.
 * Returns the public URL of the uploaded image on success.
 * Throws an Error with a user-friendly message on any failure.
 *
 * @param file   - The image File object from a file input or clipboard paste
 * @param userId - The authenticated user's UUID (used as path prefix to avoid collisions)
 * @returns      The public URL of the uploaded image
 * @throws       Error if the file is too large, wrong type, or upload fails
 */
export async function uploadEventImage(
  file: File,
  userId: string,
): Promise<string> {
  // Validate file size: reject anything larger than 5MB
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("파일 크기는 5MB 이하여야 합니다");
  }

  // Validate MIME type: only allow common image formats
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "지원하지 않는 파일 형식입니다 (jpeg, png, gif, webp만 허용)",
    );
  }

  const supabase = createClient();

  // Build a unique storage path: userId/timestamp-filename
  // The timestamp prevents collisions when the same file is uploaded multiple times
  const filePath = `${userId}/${Date.now()}-${file.name}`;

  // Upload the file to the 'event-images' bucket
  const { error: uploadError } = await supabase.storage
    .from("event-images")
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  // Retrieve the public URL for the uploaded file
  // This URL is accessible without authentication since the bucket is public
  const { data } = supabase.storage.from("event-images").getPublicUrl(filePath);

  return data.publicUrl;
}
