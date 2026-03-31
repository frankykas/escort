import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_avatar: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  reference_id: string | null;
  reference_type: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationType =
  | "booking_requested"
  | "booking_accepted"
  | "booking_declined"
  | "booking_completed"
  | "booking_cancelled"
  | "new_follower"
  | "new_subscriber"
  | "post_liked"
  | "post_commented"
  | "new_message"
  | "message_request"
  | "message_request_accepted";

// ---------------------------------------------------------------------------
// Get notifications for a user
// ---------------------------------------------------------------------------

export async function getNotifications(
  userId: string,
  limit: number = 30,
  offset: number = 0,
  unreadOnly: boolean = false
): Promise<Notification[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  let query = supabase
    .from("notifications")
    .select(`
      id,
      recipient_id,
      actor_id,
      type,
      title,
      body,
      reference_id,
      reference_type,
      is_read,
      created_at,
      actor:actor_id (username, avatar_url)
    `)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching notifications:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const actor = row.actor as unknown as { username: string; avatar_url: string | null } | null;
    return {
      id: row.id,
      recipient_id: row.recipient_id,
      actor_id: row.actor_id,
      actor_username: actor?.username ?? null,
      actor_avatar: actor?.avatar_url ?? null,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      reference_id: row.reference_id,
      reference_type: row.reference_type,
      is_read: row.is_read,
      created_at: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Get unread count
// ---------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createServerClient();
  if (!supabase) return 0;

  const { data } = await supabase
    .from("profiles")
    .select("unread_notifications_count")
    .eq("id", userId)
    .single();

  return data?.unread_notifications_count ?? 0;
}

// ---------------------------------------------------------------------------
// Mark a single notification as read
// ---------------------------------------------------------------------------

export async function markAsRead(notificationId: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
}

// ---------------------------------------------------------------------------
// Mark all notifications as read
// ---------------------------------------------------------------------------

export async function markAllAsRead(userId: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  await supabase.rpc("mark_all_notifications_read", {
    p_user_id: userId,
  });
}

// ---------------------------------------------------------------------------
// Delete a notification
// ---------------------------------------------------------------------------

export async function deleteNotification(notificationId: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  await supabase
    .from("notifications")
    .delete()
    .eq("id", notificationId);
}

// ---------------------------------------------------------------------------
// Get the link/route for a notification (for navigation on click)
// ---------------------------------------------------------------------------

export function getNotificationRoute(notification: Notification): string {
  switch (notification.type) {
    case "booking_requested":
    case "booking_accepted":
    case "booking_declined":
    case "booking_completed":
    case "booking_cancelled":
      return "/profile/bookings";

    case "new_follower":
    case "new_subscriber":
      return notification.actor_username
        ? `/u/${notification.actor_username}`
        : "/profile";

    case "post_liked":
    case "post_commented":
      return "/"; // feed / home

    case "new_message":
      return notification.actor_username
        ? `/messages/${notification.actor_username}`
        : "/messages";

    case "message_request":
      return "/messages?tab=requests";

    case "message_request_accepted":
      return notification.actor_username
        ? `/messages/${notification.actor_username}`
        : "/messages";

    default:
      return "/notifications";
  }
}
