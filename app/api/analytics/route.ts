import { NextRequest, NextResponse } from "next/server";
import { getProviderPostAnalytics, getProviderStats } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");
  const view = searchParams.get("view") ?? "stats"; // "stats" or "posts"

  if (!providerId) {
    return NextResponse.json({ error: "providerId is required" }, { status: 400 });
  }

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
