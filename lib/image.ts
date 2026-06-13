/**
 * Client-side image compression.
 *
 * Uses canvas to resize and re-encode images to a target max dimension and quality.
 * Reduces upload size dramatically (5MB iPhone photo → ~300KB) which speeds up
 * uploads and saves Supabase storage bandwidth.
 *
 * Usage:
 *   const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.82 });
 *   await supabase.storage.from("status-updates").upload(path, compressed);
 */

export type CompressOptions = {
  /** Maximum width or height in pixels. Aspect ratio is preserved. Default 1600. */
  maxDimension?: number;
  /** JPEG/WebP quality 0-1. Default 0.82. */
  quality?: number;
  /** Output mime type. Default "image/webp" — falls back to "image/jpeg" if unsupported. */
  mimeType?: "image/webp" | "image/jpeg";
};

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  quality: 0.82,
  mimeType: "image/webp",
};

/**
 * Compress an image File. Returns a new File with the same base name but
 * the appropriate extension. Skips compression for non-image files (returns as-is).
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {}
): Promise<File> {
  // Skip non-image files (videos, etc.)
  if (!file.type.startsWith("image/")) return file;

  // Skip GIFs (canvas would lose animation)
  if (file.type === "image/gif") return file;

  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...opts };

  // HEIC and some other formats can't be decoded by <img>. If decode fails,
  // return the original file so the upload still goes through (Supabase
  // Storage will accept it — the server just won't have a thumbnail).
  let bitmap: HTMLImageElement;
  try {
    bitmap = await loadImage(file);
  } catch {
    return file;
  }
  const { width, height } = scaleDimensions(bitmap.width, bitmap.height, maxDimension);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);

  // WebP isn't universally supported by canvas.toBlob — fall back to JPEG.
  const targetType = canCanvasEncode(mimeType) ? mimeType : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, targetType, quality)
  );

  if (!blob) return file;

  // If compression made the file *larger* (small images, already-optimized),
  // return the original.
  if (blob.size >= file.size) return file;

  const ext = targetType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: targetType });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function scaleDimensions(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}

let webpSupported: boolean | null = null;
function canCanvasEncode(mime: string): boolean {
  if (mime !== "image/webp") return true;
  if (webpSupported !== null) return webpSupported;
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  webpSupported = canvas.toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupported;
}

// ─── Blur preview for locked content ─────────────────────────────────────────
//
// Generates a tiny, heavily pixelated, low-quality JPEG preview that
// irreversibly destroys the image data. This is NOT a CSS filter — the actual
// pixel data is reduced to ~32px, then scaled back up, so removing styles in
// DevTools reveals nothing useful.
//
// The multi-pass approach (shrink → pixelate → blur via repeated downscale)
// makes it impossible to reconstruct the original from the preview.

const BLUR_SIZE = 32;
const BLUR_QUALITY = 0.25;

/**
 * Generate a server-side-quality blurred preview of an image file.
 * Returns a tiny JPEG File (~1-3KB) suitable for upload to a public bucket.
 * Returns null for non-image files or on failure.
 */
export async function generateBlurPreview(file: File): Promise<File | null> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return null;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }

  // Pass 1: Shrink to tiny size (destroys detail irreversibly)
  const { width: w1, height: h1 } = scaleDimensions(img.width, img.height, BLUR_SIZE);
  const tiny = document.createElement("canvas");
  tiny.width = w1;
  tiny.height = h1;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) return null;

  // Disable smoothing for the first pass to get blocky pixels
  tinyCtx.imageSmoothingEnabled = false;
  tinyCtx.drawImage(img, 0, 0, w1, h1);

  // Pass 2: Scale back up to a usable size with smoothing ON (creates the blur)
  const upscaleSize = 200;
  const { width: w2, height: h2 } = scaleDimensions(w1, h1, upscaleSize);
  const blurred = document.createElement("canvas");
  blurred.width = w2;
  blurred.height = h2;
  const blurCtx = blurred.getContext("2d");
  if (!blurCtx) return null;

  blurCtx.imageSmoothingEnabled = true;
  blurCtx.imageSmoothingQuality = "low";
  blurCtx.drawImage(tiny, 0, 0, w2, h2);

  // Pass 3: Apply additional canvas filter blur to destroy any remaining edges
  if (typeof blurCtx.filter !== "undefined") {
    const final = document.createElement("canvas");
    final.width = w2;
    final.height = h2;
    const finalCtx = final.getContext("2d");
    if (finalCtx) {
      finalCtx.filter = "blur(8px)";
      finalCtx.drawImage(blurred, 0, 0);
      // Use the further-blurred result
      blurCtx.drawImage(final, 0, 0);
    }
  }

  // Encode as very low quality JPEG
  const blob = await new Promise<Blob | null>((resolve) =>
    blurred.toBlob(resolve, "image/jpeg", BLUR_QUALITY)
  );
  if (!blob) return null;

  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-blur.jpg`, { type: "image/jpeg" });
}
