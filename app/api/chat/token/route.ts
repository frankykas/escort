import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createLiveKitToken, getLiveKitWsUrl } from "@/lib/livekit";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const channelId = req.nextUrl.searchParams.get("channelId");

  if (!userId || !channelId) {
    return NextResponse.json(
      { error: "userId and channelId are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Verify user exists
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Verify user is a member of this channel
  const { data: membership } = await supabase
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this channel" }, { status: 403 });
  }

  try {
    const token = await createLiveKitToken(userId, channelId);
    const wsUrl = getLiveKitWsUrl();

    return NextResponse.json({ token, wsUrl });
  } catch (err) {
    console.error("[chat/token] LiveKit token generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate chat token" },
      { status: 500 }
    );
  }
}
