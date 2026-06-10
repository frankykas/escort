import { NextRequest, NextResponse } from "next/server";
import { createPost, recordPostView } from "@/lib/posts";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const providerId = auth.user.id;

  const body = await req.json();
  const { caption, mediaUrl, mediaType, countryCode, postType = "post" } = body;

  if (!caption?.trim() && !mediaUrl) {
    return NextResponse.json(
      { error: "caption or mediaUrl is required" },
      { status: 400 }
    );
  }

  const result = await createPost({
    providerId,
    caption: caption?.trim() ?? "",
    mediaUrl,
    mediaType,
    postType,
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

// Record a view on a post. Anonymous views are allowed; if a Bearer token is
// present we use the verified caller id rather than trusting the body.
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { statusUpdateId } = body;

  if (!statusUpdateId) {
    return NextResponse.json({ error: "statusUpdateId is required" }, { status: 400 });
  }

  let viewerId: string | null = null;
  if (req.headers.get("authorization")) {
    const auth = await requireUser(req);
    if (auth.ok) viewerId = auth.user.id;
  }

  await recordPostView(statusUpdateId, viewerId);
  return NextResponse.json({ ok: true });
}
