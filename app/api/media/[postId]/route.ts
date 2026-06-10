import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { canAccessPost, isAdultEligible, isAdultBlockedRegion, type GatedPost } from "@/lib/access";

// ---------------------------------------------------------------------------
// GET /api/media/[postId]
//
// The entitlement gate for premium media. Returns a short-TTL signed URL for a
// post's private media IFF the caller is allowed to view it (canAccessPost).
//
// Why JSON and not a 302 redirect: premium media is loaded by <img>/next/image,
// which cannot attach the `Authorization: Bearer` header that requireUser needs.
// So the client calls this route via apiFetch (token attached), receives
// { url }, and sets that as the element src. The signed URL is itself a
// time-limited capability, safe to place in an <img src>.
//
// Public (non-premium) posts simply return their existing public media_url.
// ---------------------------------------------------------------------------

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }

  // Fetch the minimal post shape needed to decide access.
  const { data: post, error } = await supabase
    .from("status_updates")
    .select("id, provider_id, is_premium, unlock_price, media_path, media_url, content_rating")
    .eq("id", postId)
    .maybeSingle();

  if (error || !post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Identify the viewer if a token was supplied (anonymous is allowed for
  // public posts; premium posts will be rejected by canAccessPost).
  let viewerId: string | null = null;
  if (req.headers.get("authorization")) {
    const auth = await requireUser(req);
    if (auth.ok) viewerId = auth.user.id;
  }

  const gated: GatedPost = {
    id: post.id,
    provider_id: post.provider_id,
    is_premium: post.is_premium,
    unlock_price: post.unlock_price,
  };

  const allowed = await canAccessPost(viewerId, gated);
  if (!allowed) {
    // Tell the client which CTA to show without leaking the media.
    const reason = post.unlock_price != null ? "unlock" : "subscribe";
    return NextResponse.json({ error: "Locked", reason }, { status: 403 });
  }

  // Age gate: suggestive/explicit media requires an age-verified, opted-in
  // viewer (the creator's own content is exempt). Re-checked here even though
  // the feed already filters, so a direct hit to this route can't bypass it.
  const rating = (post.content_rating as string) ?? "sfw";
  if (rating !== "sfw" && viewerId !== post.provider_id) {
    if (isAdultBlockedRegion(req.headers.get("x-vercel-ip-country"))) {
      return NextResponse.json({ error: "Unavailable in your region", reason: "region" }, { status: 403 });
    }
    if (!viewerId || !(await isAdultEligible(viewerId))) {
      return NextResponse.json({ error: "Age verification required", reason: "age" }, { status: 403 });
    }
  }

  // Public post (or premium media not yet migrated): serve the public URL.
  if (!post.media_path) {
    if (!post.media_url) {
      return NextResponse.json({ error: "No media" }, { status: 404 });
    }
    return NextResponse.json({ url: post.media_url });
  }

  // Premium media lives in the private bucket — mint a short-TTL signed URL.
  const { data: signed, error: signError } = await supabase.storage
    .from("premium-content")
    .createSignedUrl(post.media_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign media" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
