import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { getStreamServerClient } from "@/lib/stream";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const stream = getStreamServerClient();
  if (!supabase || !stream) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Fetch profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_provider")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Upsert user in Stream
  try {
    await stream.upsertUser({
      id: profile.id,
      name: profile.username,
      image: profile.avatar_url ?? undefined,
    });
  } catch (err) {
    console.error("[chat/token] Stream upsertUser failed:", err);
    return NextResponse.json({ error: "Failed to sync user with chat" }, { status: 500 });
  }

  // Generate token
  const token = stream.createToken(profile.id);

  return NextResponse.json({
    token,
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
  });
}
