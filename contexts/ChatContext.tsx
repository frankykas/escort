"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Room, RoomEvent } from "livekit-client";
import type { RemoteParticipant } from "livekit-client";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api-fetch";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatMessage = {
  id: string;
  text: string;
  senderId: string;
  createdAt: string;
  attachmentUrl?: string;
  attachmentType?: "image" | "file";
};

type ChatContextValue = {
  ready: boolean;
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  sendAttachment: (file: File, caption?: string) => Promise<void>;
  uploading: boolean;
  markRead: () => Promise<void>;
};

const ChatCtx = createContext<ChatContextValue>({
  ready: false,
  messages: [],
  sendMessage: async () => {},
  sendAttachment: async () => {},
  uploading: false,
  markRead: async () => {},
});

// ---------------------------------------------------------------------------
// Provider — wraps a single thread page
// ---------------------------------------------------------------------------

export function ChatProvider({
  channelId,
  children,
}: {
  channelId: string;
  children: ReactNode;
}) {
  const { user } = useSession();
  const [ready, setReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploading, setUploading] = useState(false);
  const roomRef = useRef<Room | null>(null);

  // ── Load history from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    if (!user || !channelId) return;

    (async () => {
      const res = await fetch(
        `/api/chat/messages?channelId=${channelId}&userId=${user.id}`
      );
      if (res.ok) {
        const { messages: history } = await res.json();
        setMessages(
          (history ?? []).map((m: {
            id: string; sender_id: string; text: string; created_at: string;
            attachment_url?: string; attachment_type?: "image" | "file";
          }) => ({
            id: m.id,
            text: m.text ?? "",
            senderId: m.sender_id,
            createdAt: m.created_at,
            ...(m.attachment_url && { attachmentUrl: m.attachment_url }),
            ...(m.attachment_type && { attachmentType: m.attachment_type }),
          }))
        );
      }
    })();
  }, [user, channelId]);

  // ── Connect to LiveKit room ──────────────────────────────────────────────
  useEffect(() => {
    if (!user || !channelId) return;

    const room = new Room();
    roomRef.current = room;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/chat/token?userId=${user.id}&channelId=${channelId}`
        );
        if (!res.ok || cancelled) return;
        const { token, wsUrl } = await res.json();

        await room.connect(wsUrl, token);
        if (cancelled) { room.disconnect(); return; }

        // Listen for incoming data messages
        room.on(
          RoomEvent.DataReceived,
          (payload: Uint8Array, participant?: RemoteParticipant) => {
            try {
              const data = JSON.parse(new TextDecoder().decode(payload)) as ChatMessage;
              // Only add messages from others — our own are added optimistically
              if (participant) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === data.id)) return prev;
                  return [...prev, data];
                });
              }
            } catch {
              // Ignore malformed data
            }
          }
        );

        setReady(true);
      } catch (e) {
        console.error("[ChatProvider] LiveKit connect failed:", e);
        // Still functional — messages load from Supabase history,
        // real-time just won't work until reconnect
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      setReady(false);
    };
  }, [user, channelId]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !channelId) return;

      const msg: ChatMessage = {
        id: crypto.randomUUID(),
        text,
        senderId: user.id,
        createdAt: new Date().toISOString(),
      };

      // Optimistic UI — add immediately
      setMessages((prev) => [...prev, msg]);

      // Broadcast via RTCDataChannel if connected
      const room = roomRef.current;
      if (room?.localParticipant) {
        try {
          const encoder = new TextEncoder();
          const payload = encoder.encode(JSON.stringify(msg));
          await room.localParticipant.publishData(payload, {
            reliable: true,
          });
        } catch (e) {
          console.error("[ChatProvider] DataChannel send failed:", e);
        }
      }

      // Persist to Supabase (fire-and-forget, but log errors)
      apiFetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, text }),
      }).catch((e) => console.error("[ChatProvider] Persist failed:", e));
    },
    [user, channelId]
  );

  // ── Send attachment ───────────────────────────────────────────────────────
  const sendAttachment = useCallback(
    async (file: File, caption?: string) => {
      if (!user || !channelId) return;

      setUploading(true);
      try {
        // 1. Upload to Supabase Storage
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("chat-attachments")
          .upload(path, file, { upsert: false });

        if (uploadError) {
          console.error("[ChatProvider] Upload failed:", uploadError);
          return;
        }

        // 2. Get public URL
        const { data: urlData } = supabase.storage
          .from("chat-attachments")
          .getPublicUrl(path);

        const attachmentUrl = urlData.publicUrl;
        const attachmentType: "image" | "file" = file.type.startsWith("image/") ? "image" : "file";
        const text = caption?.trim() || "";

        // 3. Build message
        const msg: ChatMessage = {
          id: crypto.randomUUID(),
          text,
          senderId: user.id,
          createdAt: new Date().toISOString(),
          attachmentUrl,
          attachmentType,
        };

        // 4. Optimistic UI
        setMessages((prev) => [...prev, msg]);

        // 5. Broadcast metadata via LiveKit
        const room = roomRef.current;
        if (room?.localParticipant) {
          try {
            const encoder = new TextEncoder();
            const payload = encoder.encode(JSON.stringify(msg));
            await room.localParticipant.publishData(payload, { reliable: true });
          } catch (e) {
            console.error("[ChatProvider] DataChannel send failed:", e);
          }
        }

        // 6. Persist to Supabase
        apiFetch("/api/chat/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId,
            text: text || null,
            attachmentUrl,
            attachmentType,
          }),
        }).catch((e) => console.error("[ChatProvider] Persist failed:", e));
      } finally {
        setUploading(false);
      }
    },
    [user, channelId]
  );

  // ── Mark read ────────────────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!user || !channelId) return;
    await apiFetch("/api/chat/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId }),
    }).catch(() => {});
  }, [user, channelId]);

  return (
    <ChatCtx.Provider value={{ ready, messages, sendMessage, sendAttachment, uploading, markRead }}>
      {children}
    </ChatCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChat() {
  return useContext(ChatCtx);
}
