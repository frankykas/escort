import { NextRequest, NextResponse } from "next/server";
import { createStory, getActiveStories, markStoryViewed, getStoryViewers } from "@/lib/stories";
import { requireUser } from "@/lib/api-auth";

// Create a new story
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const providerId = auth.user.id;

  const body = await req.json();
  const { mediaUrl, mediaType, caption, countryCode } = body;

  if (!mediaUrl) {
    return NextResponse.json(
      { error: "mediaUrl is required" },
      { status: 400 }
    );
  }

  const result = await createStory({
    providerId,
    mediaUrl,
    mediaType,
    caption,
    countryCode,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ storyId: result.storyId });
}

// Get active stories. viewerId is derived from the session if a Bearer token is
// supplied so the "have I viewed this?" hint is trustworthy.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get("countryCode") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 30);

  let viewerId: string | undefined = undefined;
  if (req.headers.get("authorization")) {
    const auth = await requireUser(req);
    if (auth.ok) viewerId = auth.user.id;
  }

  const stories = await getActiveStories(viewerId, countryCode, limit);
  return NextResponse.json(stories);
}

// Mark story as viewed / get viewers
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { action, storyId } = body;

  if (action === "view" && storyId) {
    await markStoryViewed(storyId, userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "viewers" && storyId) {
    const viewers = await getStoryViewers(storyId);
    return NextResponse.json(viewers);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
