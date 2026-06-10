import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";

// Map a MIME type to a safe file extension. Derived from the *compressed* file's
// MIME so we never try to upload `avatar.heic` (would fail storage accept) or
// `avatar.foo` (when the original had no extension at all).
function extFromMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png")  return "png";
  if (mime === "image/gif")  return "gif";
  // Everything else (jpeg, jpg, heic originals that couldn't be re-encoded)
  // → jpg is the safest default.
  return "jpg";
}

export type UploadAvatarResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

/**
 * Upload an avatar image for a given user. Handles compression, encoding,
 * storage, and returns a public URL.
 *
 * Uses a timestamped path (`${userId}/avatar-${Date.now()}.${ext}`) so every
 * upload is a fresh INSERT — this sidesteps the `upsert`-with-RLS edge case
 * that was silently rejecting updates on existing avatars, and gives us
 * automatic cache-busting (the URL changes every time).
 */
export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<UploadAvatarResult> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "That file doesn't look like an image." };
  }

  let toUpload: File;
  try {
    toUpload = await compressImage(file, { maxDimension: 800, quality: 0.85 });
  } catch {
    // Compression should no longer throw — but if it does, fall back to the
    // original file so the user isn't stuck.
    toUpload = file;
  }

  const ext  = extFromMime(toUpload.type);
  const path = `${userId}/avatar-${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, toUpload, {
      upsert: false,                       // new path every time → no upsert
      contentType: toUpload.type,
      cacheControl: "3600",
    });

  if (uploadErr) {
    return { ok: false, error: uploadErr.message };
  }

  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
  return { ok: true, publicUrl };
}
