import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { channelId, userId } = await req.json();

  if (!channelId || !userId) {
    return NextResponse.json(
      { error: "channelId and userId are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { error } = await supabase.rpc("mark_channel_read", {
    p_channel_id: channelId,
    p_user_id: userId,
  });

  if (error) {
    console.error("[chat/mark-read] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
