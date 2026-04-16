import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createLiveKitToken, getLiveKitWsUrl } from "@/lib/livekit";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const channelId = req.nextUrl.searchParams.get("channelId");

  if (!channelId) {
    return NextResponse.json(
      { error: "channelId is required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
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
