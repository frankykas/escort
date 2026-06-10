"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";

type MessageRequest = {
  id: string;
  sender_id: string;
  recipient_id: string;
  intro_message: string | null;
  status: "pending" | "accepted" | "rejected";
  channel_id: string | null;
  created_at: string;
  sender?: { username: string; avatar_url: string | null; verification_status: string; is_provider: boolean };
  recipient?: { username: string; avatar_url: string | null; verification_status: string; is_provider: boolean };
};

type RequestStatus = {
  status: "none" | "pending" | "accepted" | "rejected";
  channelId?: string;
};

/**
 * Fetch and manage message requests for a user.
 */
export function useMessageRequests(userId: string | null, view: "pending" | "sent" | "all" | "all_pending" = "pending") {
  const [requests, setRequests] = useState<MessageRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await apiFetch(`/api/chat/requests?view=${view}`);
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
    setLoading(false);
  }, [userId, view]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const accept = async (requestId: string): Promise<{ ok: boolean; error?: string }> => {
    if (!userId) return { ok: false, error: "Not logged in" };
    try {
      const res = await apiFetch("/api/chat/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action: "accept" }),
      });
      if (res.ok) {
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        return { ok: true };
      }
      const data = await res.json().catch(() => ({}));
      const error = data.error ?? res.statusText;
      console.error("[accept] Failed:", error);
      return { ok: false, error };
    } catch (e) {
      console.error("[accept] Network error:", e);
      return { ok: false, error: "Network error — check your connection" };
    }
  };

  const reject = async (requestId: string) => {
    if (!userId) return;
    const res = await apiFetch("/api/chat/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action: "reject" }),
    });
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    }
    return res.ok;
  };

  return { requests, loading, refresh, accept, reject };
}

/**
 * Check the request status between two specific users.
 */
export function useRequestStatus(userId: string | null, recipientId: string) {
  const [status, setStatus] = useState<RequestStatus>({ status: "none" });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await apiFetch(`/api/chat/requests?recipientId=${recipientId}`);
    if (res.ok) {
      setStatus(await res.json());
    }
    setLoading(false);
  }, [userId, recipientId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...status, loading, refresh };
}
