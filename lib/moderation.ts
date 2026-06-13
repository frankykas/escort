import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// CSAM / illegal-content scanning — integration seam.
//
// This is the single server-side hook for automated media scanning. It does NOT
// itself detect anything: real detection requires a licensed provider
// (e.g. Microsoft PhotoDNA, Thorn Safer, Hive). Wire one by setting
// CSAM_SCAN_ENDPOINT (a POST endpoint that takes a media URL and returns a
// verdict) — until then, media is reported as "unscanned" and the human
// moderation queue remains the safeguard for explicit content.
//
// Recommended deployment: a Supabase Storage webhook → a route that signs a URL
// for the uploaded object and calls scanMedia(); on "flagged", quarantine the
// content (delete/hide), block the creator, and file a report per your legal
// obligations (e.g. NCMEC in the US).
// ---------------------------------------------------------------------------

export type ScanVerdict = "clean" | "flagged" | "unscanned" | "error";

export interface ScanResult {
  verdict: ScanVerdict;
  provider: string | null;
  detail?: string;
}

/**
 * Scans a signed media URL via the configured provider. Returns "unscanned"
 * when no provider is configured (so callers can decide their fail-open vs
 * fail-closed policy explicitly).
 */
export async function scanMedia(signedUrl: string): Promise<ScanResult> {
  const endpoint = process.env.CSAM_SCAN_ENDPOINT;
  if (!endpoint) {
    return { verdict: "unscanned", provider: null };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CSAM_SCAN_API_KEY ? { Authorization: `Bearer ${process.env.CSAM_SCAN_API_KEY}` } : {}),
      },
      body: JSON.stringify({ url: signedUrl }),
    });
    if (!res.ok) return { verdict: "error", provider: endpoint, detail: `HTTP ${res.status}` };
    const data = (await res.json()) as { flagged?: boolean };
    return { verdict: data.flagged ? "flagged" : "clean", provider: endpoint };
  } catch (err) {
    return { verdict: "error", provider: endpoint, detail: err instanceof Error ? err.message : "scan failed" };
  }
}

/**
 * Quarantines a flagged post: hides it from everyone and records the action.
 * Call this from your scan-webhook handler when scanMedia() returns "flagged".
 */
export async function quarantinePost(postId: string, reason: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  await supabase
    .from("status_updates")
    .update({ moderation_status: "rejected" })
    .eq("id", postId);

  await supabase.from("content_compliance").update({ review_status: "rejected" }).eq("post_id", postId);

  console.error("[moderation] QUARANTINED post", { postId, reason });
}
