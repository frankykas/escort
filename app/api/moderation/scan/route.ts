import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { scanMedia, quarantinePost } from "@/lib/moderation";

// POST /api/moderation/scan
//
// Internal scan hook. Intended to be called by a Supabase Storage webhook (or a
// queue worker) for newly-uploaded premium media. Authenticated with a shared
// secret in the `x-scan-secret` header (MODERATION_SCAN_SECRET) so it can run
// without a user session.
//
// Body: { postId } — the post whose media_path should be scanned.

export async function POST(req: NextRequest) {
  const secret = process.env.MODERATION_SCAN_SECRET;
  if (!secret || req.headers.get("x-scan-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { postId } = await req.json().catch(() => ({}));
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });

  const { data: post } = await supabase
    .from("status_updates")
    .select("id, media_path")
    .eq("id", postId)
    .maybeSingle();

  if (!post?.media_path) {
    return NextResponse.json({ error: "No media to scan" }, { status: 404 });
  }

  const { data: signed } = await supabase.storage
    .from("premium-content")
    .createSignedUrl(post.media_path, 120);

  if (!signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign media" }, { status: 500 });
  }

  const result = await scanMedia(signed.signedUrl);
  if (result.verdict === "flagged") {
    await quarantinePost(postId, `csam-scan:${result.provider}`);
  }

  return NextResponse.json({ verdict: result.verdict, provider: result.provider });
}
