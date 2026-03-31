"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { StreamChat, type OwnUserResponse, type UserResponse } from "stream-chat";
import { useSession } from "@/hooks/useSession";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StreamChatContextValue = {
  client: StreamChat | null;
  ready: boolean;
};

const StreamChatCtx = createContext<StreamChatContextValue>({
  client: null,
  ready: false,
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY ?? "";

export function StreamChatProvider({ children }: { children: ReactNode }) {
  const { user, checked } = useSession();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [ready, setReady] = useState(false);

  const connect = useCallback(async (userId: string) => {
    if (!API_KEY) return;

    // Fetch token from our API
    const res = await fetch(`/api/chat/token?userId=${userId}`);
    if (!res.ok) return;
    const { token } = await res.json();

    const chatClient = StreamChat.getInstance(API_KEY);

    // Connect user
    await chatClient.connectUser({ id: userId } as UserResponse & OwnUserResponse, token);

    setClient(chatClient);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!checked || !user) return;

    connect(user.id);

    return () => {
      // Disconnect on unmount
      setReady(false);
      setClient((prev) => {
        if (prev) prev.disconnectUser();
        return null;
      });
    };
  }, [checked, user, connect]);

  return (
    <StreamChatCtx.Provider value={{ client, ready }}>
      {children}
    </StreamChatCtx.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreamChat() {
  return useContext(StreamChatCtx);
}
