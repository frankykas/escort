"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Send, Loader2, MoreVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
};

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
};

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

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { user, checked } = useSession();

  const [partner, setPartner]     = useState<Profile | null>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [loading, setLoading]     = useState(true);
  const [input, setInput]         = useState("");
  const [sending, setSending]     = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    loadThread();
  }, [user, checked, username]);

  async function loadThread() {
    if (!user) return;
    // Fetch partner profile
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, verification_status")
      .eq("username", username)
      .single();
    if (!p) { router.replace("/messages"); return; }
    setPartner(p);

    // Fetch messages between the two users
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, body, sender_id, created_at, is_read")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${p.id}),` +
        `and(sender_id.eq.${p.id},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    setMessages((msgs as Message[]) ?? []);
    setLoading(false);

    // Mark received messages as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("sender_id", p.id)
      .eq("recipient_id", user.id)
      .eq("is_read", false);
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? "instant" : "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !partner) return;
    const channel = supabase
      .channel(`thread:${user.id}:${partner.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === partner.id) {
            setMessages((prev) => [...prev, msg]);
            supabase.from("messages").update({ is_read: true }).eq("id", msg.id);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, partner]);

  async function sendMessage() {
    if (!user || !partner || !input.trim() || sending) return;
    const body = input.trim();
    setInput("");
    setSending(true);

    // Optimistic
    const optimistic: Message = {
      id:         `opt-${Date.now()}`,
      body,
      sender_id:  user.id,
      created_at: new Date().toISOString(),
      is_read:    false,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: user.id, recipient_id: partner.id, body })
      .select("id, body, sender_id, created_at, is_read")
      .single();

    setSending(false);
    if (!error && data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? (data as Message) : m))
      );
    } else {
      // Revert optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Group messages with date separators
  const groups: Array<{ type: "separator"; label: string } | { type: "message"; msg: Message }> = [];
  let lastDate = "";
  for (const msg of messages) {
    const d = new Date(msg.created_at).toDateString();
    if (d !== lastDate) {
      groups.push({ type: "separator", label: dateSeparator(msg.created_at) });
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

        <button className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
          <MoreVertical size={18} />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center pt-16">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
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
                isMine={item.msg.sender_id === user?.id}
              />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-white/5 bg-zinc-950/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
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
    </div>
  );
}

function MessageBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[75%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug",
        isMine
          ? "rounded-tr-sm bg-amber-400 text-zinc-950"
          : "rounded-tl-sm bg-zinc-800 text-white"
      )}>
        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        <p className={cn(
          "mt-1 text-right text-[10px]",
          isMine ? "text-zinc-700" : "text-zinc-500"
        )}>
          {formatTime(msg.created_at)}
          {isMine && msg.is_read && <span className="ml-1">✓</span>}
        </p>
      </div>
    </div>
  );
}
