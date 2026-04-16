import { NextRequest, NextResponse } from "next/server";
import { getProviderPostAnalytics, getProviderStats } from "@/lib/analytics";
import { requireUser } from "@/lib/api-auth";

// Analytics are private to the provider — only the authenticated caller may
// see their own stats.
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const providerId = auth.user.id;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "stats"; // "stats" or "posts"

  if (view === "stats") {
    const stats = await getProviderStats(providerId);
    return NextResponse.json(stats);
  }

  if (view === "posts") {
    const limit = Number(searchParams.get("limit") ?? 20);
    const offset = Number(searchParams.get("offset") ?? 0);
    const analytics = await getProviderPostAnalytics(providerId, limit, offset);
    return NextResponse.json(analytics);
  }

  return NextResponse.json({ error: "view must be 'stats' or 'posts'" }, { status: 400 });
}
