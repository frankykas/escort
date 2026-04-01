"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Send, Loader2, MoreVertical, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useStreamChat } from "@/contexts/StreamChatContext";
import { ReportButton } from "@/components/ui/ReportButton";
import type { Channel as StreamChannel, MessageResponse, Event } from "stream-chat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
};

type ChatMessage = {
  id: string;
  text: string;
  userId: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dateSeparator(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });
}

function toChat(msg: MessageResponse): ChatMessage {
  return {
    id: msg.id,
    text: msg.text ?? "",
    userId: msg.user?.id ?? "",
    createdAt: msg.created_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { user, checked } = useSession();
  const { client, ready } = useStreamChat();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [noChannel, setNoChannel] = useState(false);
  const [requestPending, setRequestPending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked, router]);

  // Load partner profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("id, username, avatar_url, verification_status")
      .eq("username", username)
      .single()
      .then(({ data }) => {
        if (!data) { router.replace("/messages"); return; }
        setPartner(data);
      });
  }, [user, username, router]);

  // Check request status from Supabase, then connect to Stream channel
  const connectChannel = useCallback(async () => {
    if (!client || !ready || !user || !partner) return;

    // First check request status — the channel may have just been created
    const statusRes = await fetch(
      `/api/chat/requests?userId=${user.id}&recipientId=${partner.id}`
    );
    const statusData = statusRes.ok ? await statusRes.json() : null;

    // If no accepted request exists between these users, show pending state
    if (!statusData || statusData.status === "none") {
      setNoChannel(true);
      setRequestPending(false);
      setLoading(false);
      return;
    }

    if (statusData.status === "pending") {
      setNoChannel(true);
      setRequestPending(true);
      setLoading(false);
      return;
    }

    // Status is "accepted" — connect to the Stream channel
    // Use the channel ID from the request if available, otherwise compute it
    const cId = statusData.channelId
      ?? (() => { const [a, b] = [user.id.replace(/-/g, ""), partner.id.replace(/-/g, "")].sort(); return a + b; })();

    try {
      const ch = client.channel("messaging", cId);
      const state = await ch.watch();

      const msgs = (state.messages ?? []).map(toChat);
      setMessages(msgs);
      setChannel(ch);
      setNoChannel(false);

      await ch.markRead();
    } catch (e) {
      console.error("[thread] Stream channel watch failed:", e);
      // Channel accepted in DB but Stream channel not found — may be timing issue
      setNoChannel(true);
      setRequestPending(false);
    }

    setLoading(false);
  }, [client, ready, user, partner]);

  useEffect(() => {
    connectChannel();
  }, [connectChannel]);

  // Listen for new messages
  useEffect(() => {
    if (!channel) return;

    const handler = (event: Event) => {
      if (event.message) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === event.message!.id)) return prev;
          return [...prev, toChat(event.message as MessageResponse)];
        });
        // Auto mark read
        channel.markRead();
      }
    };

    channel.on("message.new", handler);
    return () => { channel.off("message.new", handler); };
  }, [channel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? "instant" : "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    if (!channel || !user || !input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    try {
      await channel.sendMessage({ text });
    } catch {
      // If send fails, restore input
      setInput(text);
    }

    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group messages with date separators
  const groups: Array<
    { type: "separator"; label: string } | { type: "message"; msg: ChatMessage }
  > = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.createdAt).toDateString();
    if (d !== lastDate) {
      groups.push({ type: "separator", label: dateSeparator(msg.createdAt) });
      lastDate = d;
    }
    groups.push({ type: "message", msg });
  }

  const isVerified = partner?.verification_status === "verified";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>

        {partner ? (
          <Link href={`/u/${partner.username}`} className="flex flex-1 items-center gap-2.5 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="h-9 w-9 overflow-hidden rounded-full bg-zinc-800">
                {partner.avatar_url ? (
                  <Image src={partner.avatar_url} alt={partner.username} width={36} height={36} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
                    {partner.username[0].toUpperCase()}
                  </div>
                )}
              </div>
              {isVerified && (
                <CheckCircle size={12} className="absolute -bottom-0.5 -right-0.5 fill-zinc-950 text-amber-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-white truncate leading-tight">{partner.username}</p>
              {isVerified && <p className="text-[11px] text-amber-400 leading-none">Verified</p>}
            </div>
          </Link>
        ) : (
          <div className="flex-1 h-4 w-24 animate-pulse rounded bg-zinc-800" />
        )}

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
                <Link
                  href={`/u/${partner?.username}`}
                  className="flex items-center gap-3 px-4 py-3 text-[13px] text-zinc-300 transition hover:bg-zinc-800"
                  onClick={() => setMenuOpen(false)}
                >
                  <CheckCircle size={14} className="text-zinc-500" />
                  View profile
                </Link>
                {partner && (
                  <div className="border-t border-white/5">
                    <ReportButton
                      targetType="profile"
                      targetId={partner.id}
                      className="w-full justify-start gap-3 px-4 py-3 text-[13px] text-red-400 hover:bg-zinc-800"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center pt-16">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
          </div>
        ) : noChannel ? (
          /* No channel — request pending or not yet sent */
          <div className="flex flex-col items-center justify-center gap-4 pt-20 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10">
              <Clock size={28} className="text-amber-400" />
            </div>
            <div>
              {requestPending ? (
                <>
                  <p className="text-[15px] font-semibold text-white">Request pending</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                    Your message request to @{partner?.username} is pending.
                    You&apos;ll be able to chat once they accept.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-semibold text-white">No conversation yet</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                    Send a message request to start chatting with @{partner?.username}.
                  </p>
                </>
              )}
            </div>
            <button
              onClick={() => router.push(`/u/${partner?.username}`)}
              className="rounded-full border border-white/10 px-5 py-2.5 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white"
            >
              View Profile
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/60">
              {partner?.avatar_url ? (
                <Image src={partner.avatar_url} alt="" width={64} height={64} className="rounded-2xl object-cover" />
              ) : (
                <span className="text-2xl font-bold text-zinc-400">
                  {partner?.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold text-white">@{partner?.username}</p>
            <p className="text-[12px] text-zinc-500">This is the beginning of your conversation.</p>
          </div>
        ) : (
          groups.map((item, i) =>
            item.type === "separator" ? (
              <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[11px] text-zinc-600">{item.label}</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            ) : (
              <MessageBubble
                key={item.msg.id}
                msg={item.msg}
                isMine={item.msg.userId === user?.id}
              />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input — only show when channel exists */}
      {!noChannel && !loading && (
        <div className="sticky bottom-0 border-t border-white/5 bg-zinc-950/95 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-amber-400/30 max-h-32 overflow-y-auto"
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition",
                input.trim() && !sending
                  ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              )}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-1 text-right text-[10px] text-zinc-700">{input.length}/2000</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bubble
// ---------------------------------------------------------------------------

function MessageBubble({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug",
          isMine
            ? "rounded-tr-sm bg-amber-400 text-zinc-950"
            : "rounded-tl-sm bg-zinc-800 text-white"
        )}
      >
        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
        <p
          className={cn(
            "mt-1 text-right text-[10px]",
            isMine ? "text-zinc-700" : "text-zinc-500"
          )}
        >
          {formatTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
}
