import { NextRequest, NextResponse } from "next/server";
import { getFeedPosts, addComment } from "@/lib/feed";
import { requireUser } from "@/lib/api-auth";
import { isAdultEligible, isAdultBlockedRegion } from "@/lib/access";

// Get feed posts with embedded comments
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryCode = searchParams.get("countryCode") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  // Adult content (suggestive/explicit) is only included for an authenticated
  // viewer who is age-verified and has opted in. Anonymous = SFW only. Adult
  // content is also withheld entirely in geo-restricted regions.
  const region = req.headers.get("x-vercel-ip-country");
  let allowAdult = false;
  if (req.headers.get("authorization") && !isAdultBlockedRegion(region)) {
    const auth = await requireUser(req);
    if (auth.ok) allowAdult = await isAdultEligible(auth.user.id);
  }

  const posts = await getFeedPosts({ countryCode, city, limit, offset, allowAdult });
  return NextResponse.json(posts);
}

// Add a comment to a post
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { statusUpdateId, bodyText, parentCommentId } = body;

  if (!statusUpdateId || !bodyText) {
    return NextResponse.json(
      { error: "statusUpdateId and bodyText are required" },
      { status: 400 }
    );
  }

  const result = await addComment(statusUpdateId, userId, bodyText, parentCommentId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ commentId: result.commentId });
}
