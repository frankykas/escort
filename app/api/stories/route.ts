import { NextRequest, NextResponse } from "next/server";
import { createStory, getActiveStories, markStoryViewed, getStoryViewers } from "@/lib/stories";

// Create a new story
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providerId, mediaUrl, mediaType, caption, countryCode } = body;

  if (!providerId || !mediaUrl) {
    return NextResponse.json(
      { error: "providerId and mediaUrl are required" },
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

// Get active stories
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const viewerId = searchParams.get("viewerId") ?? undefined;
  const countryCode = searchParams.get("countryCode") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 30);

  const stories = await getActiveStories(viewerId, countryCode, limit);
  return NextResponse.json(stories);
}

// Mark story as viewed / get viewers
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { action, storyId, userId } = body;

  if (action === "view" && storyId && userId) {
    await markStoryViewed(storyId, userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "viewers" && storyId) {
    const viewers = await getStoryViewers(storyId);
    return NextResponse.json(viewers);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
