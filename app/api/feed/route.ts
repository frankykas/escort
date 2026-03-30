import { NextRequest, NextResponse } from "next/server";
import { getFeedPosts, addComment, getPostComments } from "@/lib/feed";

// Get feed posts with embedded comments
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get("countryCode") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  const posts = await getFeedPosts({ countryCode, city, limit, offset });
  return NextResponse.json(posts);
}

// Add a comment to a post
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { statusUpdateId, userId, bodyText, parentCommentId } = body;

  if (!statusUpdateId || !userId || !bodyText) {
    return NextResponse.json(
      { error: "statusUpdateId, userId, and bodyText are required" },
      { status: 400 }
    );
  }

  const result = await addComment(statusUpdateId, userId, bodyText, parentCommentId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ commentId: result.commentId });
}
