import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";

// GET /api/chat/attachment/[messageId]
//
// Entitlement gate for locked DM media. Returns a short-TTL signed URL for a
// locked message's private attachment only if the caller is the sender or has
// unlocked it (content_unlocks, content_type='message') AND is a channel member.

const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }

  const { data: msg } = await supabase
    .from("chat_messages")
    .select("id, channel_id, sender_id, is_locked, attachment_path")
    .eq("id", messageId)
    .maybeSingle();

  if (!msg || !msg.attachment_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Must be a member of the channel.
  const { data: member } = await supabase
    .from("chat_channel_members")
    .select("user_id")
    .eq("channel_id", msg.channel_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Entitlement: sender always; otherwise must have unlocked.
  if (msg.is_locked && msg.sender_id !== userId) {
    const { data: unlock } = await supabase
      .from("content_unlocks")
      .select("id")
      .eq("user_id", userId)
      .eq("content_id", messageId)
      .eq("content_type", "message")
      .maybeSingle();
    if (!unlock) {
      return NextResponse.json({ error: "Locked", reason: "unlock" }, { status: 403 });
    }
  }

  const { data: signed, error } = await supabase.storage
    .from("premium-content")
    .createSignedUrl(msg.attachment_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "Could not sign media" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
