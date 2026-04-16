import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// GET — Fetch message history for a channel (paginated)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { searchParams } = req.nextUrl;
  const channelId = searchParams.get("channelId");
  const before = searchParams.get("before"); // ISO timestamp cursor
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

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

  // Verify membership
  const { data: member } = await supabase
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Fetch messages
  let query = supabase
    .from("chat_messages")
    .select("id, channel_id, sender_id, text, created_at, attachment_url, attachment_type")
    .eq("channel_id", channelId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data: messages, error } = await query;

  if (error) {
    console.error("[chat/messages] GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages ?? [] });
}

// ---------------------------------------------------------------------------
// POST — Persist a message (called after RTCDataChannel delivery)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { channelId, text, attachmentUrl, attachmentType } = body;

  if (!channelId) {
    return NextResponse.json(
      { error: "channelId is required" },
      { status: 400 }
    );
  }

  // Must have text or attachment
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.length > 0;

  if (!hasText && !hasAttachment) {
    return NextResponse.json(
      { error: "text or attachment is required" },
      { status: 400 }
    );
  }

  if (hasText && text.length > 2000) {
    return NextResponse.json(
      { error: "text must be 2000 characters or less" },
      { status: 400 }
    );
  }

  if (hasAttachment && attachmentType !== "image" && attachmentType !== "file") {
    return NextResponse.json(
      { error: "attachmentType must be 'image' or 'file'" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  // Verify membership
  const { data: member } = await supabase
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", channelId)
    .eq("user_id", userId)
    .single();

  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Insert message
  const { data: message, error } = await supabase
    .from("chat_messages")
    .insert({
      channel_id: channelId,
      sender_id: userId,
      text: hasText ? text.trim() : null,
      ...(hasAttachment && { attachment_url: attachmentUrl, attachment_type: attachmentType }),
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[chat/messages] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: message.id, created_at: message.created_at });
}
