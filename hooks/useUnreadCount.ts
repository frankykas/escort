"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { supabase } from "@/lib/supabase/client";

/**
 * Returns total unread count: unread chat messages + pending message requests.
 * Uses Supabase RPC for unread messages and Realtime for live updates.
 * Replaces the old useStreamUnread hook.
 */
export function useUnreadMessages(): number {
  const { user, checked } = useSession();
  const { isProvider } = useProfile();
  const [messageCount, setMessageCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCounts = useCallback(
    async (userId: string) => {
      // Unread messages via RPC
      const { data: unread } = await supabase.rpc("get_unread_count", {
        p_user_id: userId,
      });
      setMessageCount(typeof unread === "number" ? unread : 0);

      // Pending requests (providers only)
      if (isProvider) {
        const { count } = await supabase
          .from("message_requests")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .eq("status", "pending");
        setRequestCount(count ?? 0);
      }
    },
    [isProvider]
  );

  useEffect(() => {
    if (!checked || !user) return;

    // Initial fetch
    fetchCounts(user.id);

    // Subscribe to new messages via Supabase Realtime
    const channel = supabase
      .channel("unread-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => fetchCounts(user.id)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_channel_members" },
        () => fetchCounts(user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_requests" },
        () => fetchCounts(user.id)
      )
      .subscribe();

    // Listen for custom refresh events (fired after accept/reject/mark-read)
    function handleRefresh() {
      fetchCounts(user!.id);
    }
    window.addEventListener("unread-refresh", handleRefresh);

    // Re-fetch when tab becomes visible (catches stale state from background)
    function handleVisibility() {
      if (document.visibilityState === "visible") fetchCounts(user!.id);
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Also poll requests for providers (Realtime may not cover all edge cases)
    if (isProvider) {
      intervalRef.current = setInterval(() => fetchCounts(user.id), 30_000);
    }

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("unread-refresh", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checked, user, isProvider, fetchCounts]);

  return messageCount + requestCount;
}
