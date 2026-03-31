"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { StreamChat, type Event } from "stream-chat";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY ?? "";

/**
 * Combines Stream chat unread count + pending Supabase message requests.
 * Used in BottomNav (renders app-wide, outside StreamChatProvider).
 */
export function useStreamUnread(): number {
  const { user, checked } = useSession();
  const { isProvider } = useProfile();
  const [streamCount, setStreamCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stream chat unread ──────────────────────────────────────────────────
  const connect = useCallback(async (userId: string) => {
    if (!API_KEY) return null;

    try {
      const res = await fetch(`/api/chat/token?userId=${userId}`);
      if (!res.ok) return null;
      const { token } = await res.json();

      const client = StreamChat.getInstance(API_KEY);
      const connection = await client.connectUser({ id: userId }, token);

      setStreamCount(connection?.me?.total_unread_count ?? 0);

      const handler = (event: Event) => {
        if (event.total_unread_count !== undefined) {
          setStreamCount(event.total_unread_count);
        }
      };

      client.on("notification.message_new", handler);
      client.on("notification.mark_read", handler);

      return client;
    } catch (e) {
      console.error("[useStreamUnread] Stream connect failed:", e);
      return null;
    }
  }, []);

  // ── Pending message requests (Supabase polling) ─────────────────────────
  const fetchPendingRequests = useCallback(async (userId: string) => {
    const { count } = await supabase
      .from("message_requests")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .eq("status", "pending");

    setRequestCount(count ?? 0);
  }, []);

  useEffect(() => {
    if (!checked || !user) return;

    let client: StreamChat | null = null;

    connect(user.id).then((c) => {
      client = c;
    });

    // Poll pending requests for providers
    if (isProvider) {
      fetchPendingRequests(user.id);
      intervalRef.current = setInterval(() => fetchPendingRequests(user.id), 30_000);
    }

    return () => {
      if (client) client.disconnectUser();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checked, user, connect, isProvider, fetchPendingRequests]);

  return streamCount + requestCount;
}
