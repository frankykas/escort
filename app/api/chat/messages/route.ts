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
    .select("id, channel_id, sender_id, text, created_at, attachment_url, attachment_type, is_locked, unlock_price, attachment_path")
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

  // Resolve which locked messages this viewer has unlocked, then gate content.
  const lockedIds = (messages ?? [])
    .filter((m) => m.is_locked && m.sender_id !== userId)
    .map((m) => m.id);

  let unlockedSet = new Set<string>();
  if (lockedIds.length) {
    const { data: unlocks } = await supabase
      .from("content_unlocks")
      .select("content_id")
      .eq("user_id", userId)
      .eq("content_type", "message")
      .in("content_id", lockedIds);
    unlockedSet = new Set((unlocks ?? []).map((u) => u.content_id as string));
  }

  const gated = (messages ?? []).map((m) => {
    const unlocked = !m.is_locked || m.sender_id === userId || unlockedSet.has(m.id);
    // Never leak private paths or the locked attachment to the client.
    const safe = {
      id: m.id,
      channel_id: m.channel_id,
      sender_id: m.sender_id,
      created_at: m.created_at,
      is_locked: !!m.is_locked,
      unlock_price: m.unlock_price ?? null,
      unlocked,
      // Text is shown as a teaser even when locked; media is withheld.
      text: m.text,
      attachment_type: m.attachment_type,
      // Public (non-locked) attachments keep their URL; locked attachments are
      // fetched via /api/chat/attachment/[id] only after unlock.
      attachment_url: m.is_locked ? null : m.attachment_url,
      has_locked_attachment: !!(m.is_locked && m.attachment_path),
    };
    return safe;
  });

  return NextResponse.json({ messages: gated });
}

// ---------------------------------------------------------------------------
// POST — Persist a message (called after RTCDataChannel delivery)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { channelId, text, attachmentUrl, attachmentType, isLocked, unlockPrice, attachmentPath } = body;

  if (!channelId) {
    return NextResponse.json(
      { error: "channelId is required" },
      { status: 400 }
    );
  }

  // A locked message carries its media privately (attachment_path), not a URL.
  const locked = isLocked === true;
  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasAttachment = typeof attachmentUrl === "string" && attachmentUrl.length > 0;
  const hasLockedAttachment = locked && typeof attachmentPath === "string" && attachmentPath.length > 0;

  if (!hasText && !hasAttachment && !hasLockedAttachment) {
    return NextResponse.json(
      { error: "text or attachment is required" },
      { status: 400 }
    );
  }

  if (locked) {
    const price = Number(unlockPrice);
    if (!Number.isInteger(price) || price < 100 || price > 1_000_000) {
      return NextResponse.json({ error: "Locked messages require a valid unlock price" }, { status: 400 });
    }
    if (!hasLockedAttachment) {
      return NextResponse.json({ error: "Locked messages require an attachment" }, { status: 400 });
    }
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
      ...(hasAttachment && !locked && { attachment_url: attachmentUrl, attachment_type: attachmentType }),
      ...(locked && {
        is_locked: true,
        unlock_price: Number(unlockPrice),
        attachment_path: attachmentPath,
        attachment_type: attachmentType ?? "image",
      }),
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("[chat/messages] POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: message.id, created_at: message.created_at });
}
