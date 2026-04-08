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

  const bitmap = await loadImage(file);
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
