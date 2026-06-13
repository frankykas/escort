import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  intro_message: string | null;
  status: "pending" | "accepted" | "rejected";
  channel_id: string | null;
  created_at: string;
  updated_at: string;
  sender?: { username: string; avatar_url: string | null; verification_status: string; is_provider: boolean };
  recipient?: { username: string; avatar_url: string | null; verification_status: string; is_provider: boolean };
};

type ActionResult = { success: boolean; error?: string; data?: Record<string, unknown> };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function channelId(id1: string, id2: string): string {
  // Two UUIDs without hyphens, sorted and concatenated = 32+32 = 64 chars.
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
  view: "pending" | "sent" | "all" | "all_pending" = "pending"
): Promise<MessageRequest[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("message_requests")
    .select(`
      id, sender_id, recipient_id, intro_message, status,
      channel_id, created_at, updated_at,
      sender:sender_id (username, avatar_url, verification_status, is_provider),
      recipient:recipient_id (username, avatar_url, verification_status, is_provider)
    `)
    .order("created_at", { ascending: false });

  if (view === "pending") {
    query = query.eq("recipient_id", userId).eq("status", "pending");
  } else if (view === "sent") {
    query = query.eq("sender_id", userId).eq("status", "pending");
  } else if (view === "all_pending") {
    query = query
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq("status", "pending");
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
    .select("status, channel_id")
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
    channelId: data.channel_id ?? undefined,
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
  if (!supabase) return { success: false, error: "Database unavailable" };

  // Fetch the request and validate
  const { data: request, error: fetchError } = await supabase
    .from("message_requests")
    .select("id, sender_id, recipient_id, intro_message, status")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) return { success: false, error: "Request not found" };
  if (request.recipient_id !== userId) return { success: false, error: "Not authorized" };
  if (request.status !== "pending") return { success: false, error: "Request already processed" };

  // Build channel ID
  const cId = channelId(request.sender_id, request.recipient_id);

  // Create chat channel + members + optional intro message in Supabase
  try {
    // 1. Create the channel
    const { error: chError } = await supabase
      .from("chat_channels")
      .insert({ id: cId, created_by: userId });

    if (chError) {
      // If channel already exists (e.g. re-accept race), that's fine
      if (!chError.message.includes("duplicate")) {
        throw new Error(chError.message);
      }
    }

    // 2. Add both users as members
    const { error: memError } = await supabase
      .from("chat_channel_members")
      .upsert([
        { channel_id: cId, user_id: request.sender_id },
        { channel_id: cId, user_id: request.recipient_id },
      ]);

    if (memError) throw new Error(memError.message);

    // 3. Insert intro message as first message in the channel
    if (request.intro_message) {
      const { error: msgError } = await supabase
        .from("chat_messages")
        .insert({
          channel_id: cId,
          sender_id: request.sender_id,
          text: request.intro_message,
        });

      if (msgError) {
        console.error("[chat] Failed to insert intro message:", msgError);
      }
    }
  } catch (e) {
    console.error("[chat] Channel creation failed:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Failed to create chat channel: ${errMsg}` };
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("message_requests")
    .update({
      status: "accepted",
      channel_id: cId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) return { success: false, error: updateError.message };

  // Notify sender that their request was accepted
  const { data: recipientProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

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
