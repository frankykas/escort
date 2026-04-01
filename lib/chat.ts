import { createServerClient } from "@/lib/supabase/server";
import { getStreamServerClient } from "@/lib/stream";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  intro_message: string | null;
  status: "pending" | "accepted" | "rejected";
  stream_channel_id: string | null;
  created_at: string;
  updated_at: string;
  sender?: { username: string; avatar_url: string | null; verification_status: string };
  recipient?: { username: string; avatar_url: string | null; verification_status: string };
};

type ActionResult = { success: boolean; error?: string; data?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function channelId(id1: string, id2: string): string {
  // Stream max channel ID is 64 chars. Two UUIDs without hyphens = 32+32 = 64.
  const [a, b] = [id1.replace(/-/g, ""), id2.replace(/-/g, "")].sort();
  return a + b;
}

// ---------------------------------------------------------------------------
// Create a message request
// ---------------------------------------------------------------------------

export async function createMessageRequest(
  senderId: string,
  recipientId: string,
  introMessage?: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  // Check if sender is blocked by recipient
  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", recipientId)
    .eq("blocked_id", senderId)
    .maybeSingle();

  if (blocked) return { success: false, error: "Unable to send request" };

  // Check if a request already exists
  const { data: existing } = await supabase
    .from("message_requests")
    .select("id, status")
    .eq("sender_id", senderId)
    .eq("recipient_id", recipientId)
    .single();

  if (existing) {
    if (existing.status === "accepted") {
      return { success: true, data: { alreadyAccepted: true, requestId: existing.id } };
    }
    if (existing.status === "pending") {
      return { success: false, error: "You already have a pending request" };
    }
    // If rejected, allow re-sending by updating the existing row
    const { error: updateError } = await supabase
      .from("message_requests")
      .update({
        intro_message: introMessage?.trim() || null,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (updateError) return { success: false, error: updateError.message };

    // Create notification for recipient
    await createRequestNotification(supabase, senderId, recipientId, introMessage);

    return { success: true, data: { requestId: existing.id } };
  }

  // Create new request
  const { data, error } = await supabase
    .from("message_requests")
    .insert({
      sender_id: senderId,
      recipient_id: recipientId,
      intro_message: introMessage?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Create notification for recipient
  await createRequestNotification(supabase, senderId, recipientId, introMessage);

  return { success: true, data: { requestId: data.id } };
}

// ---------------------------------------------------------------------------
// Get message requests
// ---------------------------------------------------------------------------

export async function getMessageRequests(
  userId: string,
  view: "pending" | "sent" | "all" = "pending"
): Promise<MessageRequest[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("message_requests")
    .select(`
      id, sender_id, recipient_id, intro_message, status,
      stream_channel_id, created_at, updated_at,
      sender:sender_id (username, avatar_url, verification_status),
      recipient:recipient_id (username, avatar_url, verification_status)
    `)
    .order("created_at", { ascending: false });

  if (view === "pending") {
    query = query.eq("recipient_id", userId).eq("status", "pending");
  } else if (view === "sent") {
    query = query.eq("sender_id", userId);
  } else {
    query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((row) => ({
    ...row,
    sender: row.sender as unknown as MessageRequest["sender"],
    recipient: row.recipient as unknown as MessageRequest["recipient"],
  })) as MessageRequest[];
}

// ---------------------------------------------------------------------------
// Get request status between two users
// ---------------------------------------------------------------------------

export async function getRequestStatus(
  senderId: string,
  recipientId: string
): Promise<{ status: "none" | "pending" | "accepted" | "rejected"; channelId?: string }> {
  const supabase = createServerClient();
  if (!supabase) return { status: "none" };

  // Check both directions
  const { data } = await supabase
    .from("message_requests")
    .select("status, stream_channel_id")
    .or(
      `and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),` +
      `and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`
    )
    .in("status", ["pending", "accepted"])
    .limit(1)
    .single();

  if (!data) return { status: "none" };

  return {
    status: data.status as "pending" | "accepted",
    channelId: data.stream_channel_id ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Accept a message request
// ---------------------------------------------------------------------------

export async function acceptMessageRequest(
  requestId: string,
  userId: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  const stream = getStreamServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };
  if (!stream) return { success: false, error: "Chat service unavailable" };

  // Fetch the request and validate
  const { data: request, error: fetchError } = await supabase
    .from("message_requests")
    .select("id, sender_id, recipient_id, intro_message, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) return { success: false, error: "Request not found" };
  if (request.recipient_id !== userId) return { success: false, error: "Not authorized" };
  if (request.status !== "pending") return { success: false, error: "Request already processed" };

  // Fetch both profiles for Stream user upsert
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, is_provider")
    .in("id", [request.sender_id, request.recipient_id]);

  if (!profiles || profiles.length < 2) return { success: false, error: "Profiles not found" };

  // Upsert both users in Stream
  try {
    for (const p of profiles) {
      await stream.upsertUser({
        id: p.id,
        name: p.username,
        image: p.avatar_url ?? undefined,
      });
    }
  } catch (e) {
    console.error("[chat] Stream upsertUser failed:", e);
    return { success: false, error: "Failed to set up chat users" };
  }

  // Create Stream channel
  const cId = channelId(request.sender_id, request.recipient_id);
  try {
    const channel = stream.channel("messaging", cId, {
      created_by_id: request.recipient_id,
    });
    await channel.create();

    // Add both users as members
    await channel.addMembers([request.sender_id, request.recipient_id]);

    // Send intro message as first message in the channel
    if (request.intro_message) {
      await channel.sendMessage({
        text: request.intro_message,
        user_id: request.sender_id,
      });
    }
  } catch (e) {
    console.error("[chat] Stream channel creation failed:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to create chat channel: ${errMsg}` };
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("message_requests")
    .update({
      status: "accepted",
      stream_channel_id: cId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) return { success: false, error: updateError.message };

  // Notify sender that their request was accepted
  const recipientProfile = profiles.find((p) => p.id === userId);
  await supabase.from("notifications").insert({
    recipient_id: request.sender_id,
    actor_id: userId,
    type: "message_request_accepted",
    title: "Message request accepted",
    body: `@${recipientProfile?.username ?? "Someone"} accepted your message request`,
    reference_id: request.sender_id,
    reference_type: "message",
  });

  return { success: true, data: { channelId: cId } };
}

// ---------------------------------------------------------------------------
// Reject a message request
// ---------------------------------------------------------------------------

export async function rejectMessageRequest(
  requestId: string,
  userId: string
): Promise<ActionResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { data: request } = await supabase
    .from("message_requests")
    .select("id, recipient_id, status")
    .eq("id", requestId)
    .single();

  if (!request) return { success: false, error: "Request not found" };
  if (request.recipient_id !== userId) return { success: false, error: "Not authorized" };
  if (request.status !== "pending") return { success: false, error: "Request already processed" };

  const { error } = await supabase
    .from("message_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ---------------------------------------------------------------------------
// Internal: create notification for message request
// ---------------------------------------------------------------------------

async function createRequestNotification(
  supabase: ReturnType<typeof createServerClient>,
  senderId: string,
  recipientId: string,
  introMessage?: string
) {
  if (!supabase) return;

  const { data: sender } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", senderId)
    .single();

  await supabase.from("notifications").insert({
    recipient_id: recipientId,
    actor_id: senderId,
    type: "message_request",
    title: "New message request",
    body: sender?.username
      ? `@${sender.username} wants to chat${introMessage ? ": " + introMessage.substring(0, 80) : ""}`
      : "Someone wants to chat with you",
    reference_id: senderId,
    reference_type: "message_request",
  });
}
