import { randomUUID } from "crypto";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Live shows — server-side helpers.
// Tickets are content_unlocks rows (content_type='stream'); the LiveKit token
// route enforces entitlement. Tips reuse the standard payment rail.
// ---------------------------------------------------------------------------

export interface LiveStream {
  id: string;
  creator_id: string;
  title: string;
  status: "scheduled" | "live" | "ended";
  ticket_price: number;
  room_name: string;
  viewer_count: number;
  started_at: string | null;
  created_at: string;
  creator_username?: string | null;
  creator_avatar?: string | null;
}

export async function createStream(
  creatorId: string,
  title: string,
  ticketPriceCents: number
): Promise<{ success: boolean; stream?: LiveStream; error?: string }> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { data, error } = await supabase
    .from("live_streams")
    .insert({
      creator_id: creatorId,
      title: title.trim().slice(0, 120),
      status: "live",
      ticket_price: Math.max(0, Math.round(ticketPriceCents)),
      room_name: `stream-${randomUUID()}`,
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, stream: data as LiveStream };
}

export async function getLiveStreams(): Promise<LiveStream[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("live_streams")
    .select("*, creator:creator_id (username, avatar_url)")
    .eq("status", "live")
    .order("started_at", { ascending: false });

  return (data ?? []).map((s) => {
    const creator = s.creator as unknown as { username: string; avatar_url: string | null } | null;
    return { ...s, creator_username: creator?.username ?? null, creator_avatar: creator?.avatar_url ?? null };
  }) as LiveStream[];
}

export async function getStream(id: string): Promise<LiveStream | null> {
  const supabase = createServerClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("live_streams")
    .select("*, creator:creator_id (username, avatar_url)")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  const creator = data.creator as unknown as { username: string; avatar_url: string | null } | null;
  return { ...data, creator_username: creator?.username ?? null, creator_avatar: creator?.avatar_url ?? null } as LiveStream;
}

export async function endStream(creatorId: string, id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { error } = await supabase
    .from("live_streams")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("creator_id", creatorId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function hasStreamTicket(userId: string, streamId: string): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("content_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("content_id", streamId)
    .eq("content_type", "stream")
    .maybeSingle();

  return !!data;
}
