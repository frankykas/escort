import { NextRequest, NextResponse } from "next/server";
import { createPost, recordPostView } from "@/lib/posts";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providerId, caption, mediaUrl, mediaType, countryCode } = body;

  if (!providerId || !caption || !mediaUrl) {
    return NextResponse.json(
      { error: "providerId, caption, and mediaUrl are required" },
      { status: 400 }
    );
  }

  const result = await createPost({
    providerId,
    caption,
    mediaUrl,
    mediaType,
    countryCode,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error, cooldownRemainingMinutes: result.cooldownRemainingMinutes },
      { status: 403 }
    );
  }

  return NextResponse.json({ postId: result.postId });
}

// Record a view on a post
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { statusUpdateId, viewerId } = body;

  if (!statusUpdateId) {
    return NextResponse.json({ error: "statusUpdateId is required" }, { status: 400 });
  }

  await recordPostView(statusUpdateId, viewerId ?? null);
  return NextResponse.json({ ok: true });
}
