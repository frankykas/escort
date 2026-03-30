"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import type { Notification, NotificationType } from "@/lib/notifications";

// Re-export for convenience in components
export type { Notification, NotificationType };

// ---------------------------------------------------------------------------
// Hook: useUnreadCount — polls for badge count
// ---------------------------------------------------------------------------

export function useUnreadCount(pollIntervalMs: number = 30_000) {
  const { profile } = useProfile();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!profile) return;

    const { data } = await supabase
      .from("profiles")
      .select("unread_notifications_count")
      .eq("id", profile.id)
      .single();

    setCount(data?.unread_notifications_count ?? 0);
  }, [profile]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchCount, pollIntervalMs]);

  return { count, refresh: fetchCount };
}

// ---------------------------------------------------------------------------
// Hook: useNotifications — full notification list with actions
// ---------------------------------------------------------------------------

export function useNotifications(limit: number = 30) {
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const fetchNotifications = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      if (!profile) return;
      setLoading(true);

      const { data } = await supabase
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
        .eq("recipient_id", profile.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      const mapped = (data ?? []).map((row) => {
        const actor = row.actor as unknown as {
          username: string;
          avatar_url: string | null;
        } | null;
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

      setHasMore(mapped.length === limit);
      setNotifications((prev) => (append ? [...prev, ...mapped] : mapped));
      setLoading(false);
    },
    [profile, limit]
  );

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!profile) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );

      await supabase.rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });
    },
    [profile]
  );

  const markAllAsRead = useCallback(async () => {
    if (!profile) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));

    await supabase.rpc("mark_all_notifications_read", {
      p_user_id: profile.id,
    });
  }, [profile]);

  const loadMore = useCallback(() => {
    fetchNotifications(notifications.length, true);
  }, [fetchNotifications, notifications.length]);

  return {
    notifications,
    loading,
    hasMore,
    markAsRead,
    markAllAsRead,
    loadMore,
    refresh: () => fetchNotifications(),
  };
}
