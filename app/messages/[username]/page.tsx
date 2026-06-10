"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Send, Loader2, MoreVertical, Clock, ShieldBan, X, ImagePlus, FileIcon, Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useProfile } from "@/contexts/ProfileContext";
import { ChatProvider, useChat, type ChatMessage } from "@/contexts/ChatContext";
import { ReportButton } from "@/components/ui/ReportButton";
import { USE_CREATOR_CONTENT } from "@/lib/features";
import PayButton from "@/components/creator/PayButton";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function channelId(id1: string, id2: string): string {
  const [a, b] = [id1.replace(/-/g, ""), id2.replace(/-/g, "")].sort();
  return a + b;
}

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

// ---------------------------------------------------------------------------
// Page wrapper — resolves partner + request status, then mounts ChatProvider
// ---------------------------------------------------------------------------

export default function ThreadPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;
  const { user, checked } = useSession();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [channelReady, setChannelReady] = useState(false);
  const [cId, setCId] = useState<string | null>(null);
  const [noChannel, setNoChannel] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [loading, setLoading] = useState(true);

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

  // Check request status
  const checkStatus = useCallback(async () => {
    if (!user || !partner) return;

    const res = await fetch(
      `/api/chat/requests?userId=${user.id}&recipientId=${partner.id}`
    );
    const data = res.ok ? await res.json() : null;

    if (!data || data.status === "none") {
      setNoChannel(true);
      setRequestPending(false);
    } else if (data.status === "pending") {
      setNoChannel(true);
      setRequestPending(true);
    } else {
      // Accepted — compute or use returned channelId
      const id = data.channelId ?? channelId(user.id, partner.id);
      setCId(id);
      setChannelReady(true);
      setNoChannel(false);
    }

    setLoading(false);
  }, [user, partner]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  if (loading || !partner) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafbfc]">
        <Loader2 size={24} className="animate-spin text-slate-300" />
      </div>
    );
  }

  if (noChannel) {
    return (
      <NoChannelView
        partner={partner}
        requestPending={requestPending}
      />
    );
  }

  if (channelReady && cId) {
    return (
      <ChatProvider channelId={cId}>
        <ThreadView partner={partner} />
      </ChatProvider>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// No-channel view (pending or not yet sent)
// ---------------------------------------------------------------------------

function NoChannelView({
  partner,
  requestPending,
}: {
  partner: Profile;
  requestPending: boolean;
}) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-[#fafbfc]">
      <ThreadHeader partner={partner} />
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-50">
          <Clock size={28} className="text-pink-500" />
        </div>
        <div>
          {requestPending ? (
            <>
              <p className="text-[15px] font-semibold text-slate-800">Request pending</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                Your message request to @{partner.username} is pending.
                You&apos;ll be able to chat once they accept.
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-semibold text-slate-800">No conversation yet</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                Send a message request to start chatting with @{partner.username}.
              </p>
            </>
          )}
        </div>
        <button
          onClick={() => router.push(`/u/${partner.username}`)}
          className="rounded-full border border-gray-200 px-5 py-2.5 text-[13px] font-medium text-slate-600 transition-all hover:border-gray-300 hover:text-slate-700"
        >
          View Profile
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread view — wraps useChat(), handles messages + block logic
// ---------------------------------------------------------------------------

function ThreadView({ partner }: { partner: Profile }) {
  const { user } = useSession();
  const { isProvider } = useProfile();
  const { messages, sendMessage, sendAttachment, sendLockedAttachment, uploading, markRead } = useChat();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Locked (pay-per-view) attachment composer — creators only.
  const [lockArmed, setLockArmed] = useState(false);
  const [lockPrice, setLockPrice] = useState("");
  const canSendLocked = USE_CREATOR_CONTENT && isProvider;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [expiryLabel, setExpiryLabel] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mark read on mount and when new messages arrive
  useEffect(() => {
    markRead();
  }, [messages.length, markRead]);

  // Live countdown timer — fetch channel created_at and update every minute
  useEffect(() => {
    if (!user || !partner) return;

    const cId = [user.id.replace(/-/g, ""), partner.id.replace(/-/g, "")]
      .sort()
      .join("");

    let interval: ReturnType<typeof setInterval> | null = null;

    async function fetchAndCompute() {
      const { data } = await supabase
        .from("chat_channels")
        .select("created_at")
        .eq("id", cId)
        .single();

      if (!data?.created_at) return;

      const createdAt = new Date(data.created_at).getTime();

      function update() {
        const remaining = createdAt + 24 * 60 * 60 * 1000 - Date.now();
        if (remaining <= 0) {
          setExpiryLabel("Chat expired");
          if (interval) clearInterval(interval);
          return;
        }
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        if (h > 0) {
          setExpiryLabel(`${h}h ${m}m remaining`);
        } else {
          setExpiryLabel(`${m}m remaining`);
        }
      }

      update();
      interval = setInterval(update, 60_000);
    }

    fetchAndCompute();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user, partner]);

  // Check block status in both directions
  useEffect(() => {
    if (!user || !partner) return;
    if (isProvider) {
      apiFetch(`/api/block?blockerId=${user.id}&blockedId=${partner.id}`)
        .then((r) => r.json())
        .then((d) => setIsBlocked(d.blocked ?? false))
        .catch(() => {});
    }
    apiFetch(`/api/block?blockerId=${partner.id}&blockedId=${user.id}`)
      .then((r) => r.json())
      .then((d) => setBlockedByThem(d.blocked ?? false))
      .catch(() => {});
  }, [user, partner, isProvider]);

  function handleBlockClick() {
    if (isBlocked) {
      confirmBlock();
    } else {
      setBlockConfirmOpen(true);
    }
  }

  async function confirmBlock() {
    if (!user || !partner || blocking) return;
    setBlocking(true);
    setBlockConfirmOpen(false);
    const method = isBlocked ? "DELETE" : "POST";
    await apiFetch("/api/block", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: partner.id }),
    });
    setIsBlocked(!isBlocked);
    setBlocking(false);
  }

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    await sendMessage(text);
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";
    const priceCents = Math.round(parseFloat(lockPrice || "0") * 100);
    if (canSendLocked && lockArmed && priceCents >= 100) {
      await sendLockedAttachment(file, priceCents, input.trim() || undefined);
      setLockArmed(false);
      setLockPrice("");
    } else {
      await sendAttachment(file, input.trim() || undefined);
    }
    setInput("");
  }

  // Group messages with date separators
  const groups: Array<
    { type: "separator"; label: string } | { type: "message"; msg: typeof messages[0] }
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

  return (
    <div className="flex min-h-screen flex-col bg-[#fafbfc]">
      <ThreadHeader
        partner={partner}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        isProvider={isProvider}
        isBlocked={isBlocked}
        blocking={blocking}
        onBlockClick={() => { handleBlockClick(); setMenuOpen(false); }}
      />

      {/* 24h expiry countdown */}
      <div className={cn(
        "flex items-center justify-center gap-1.5 border-b border-gray-200 px-3 py-1.5",
        expiryLabel === "Chat expired"
          ? "bg-red-500/10"
          : "bg-gray-50"
      )}>
        <Clock size={11} className={expiryLabel === "Chat expired" ? "text-red-400" : "text-slate-300"} />
        <span className={cn(
          "text-[11px]",
          expiryLabel === "Chat expired" ? "text-red-400 font-medium" : "text-slate-300"
        )}>
          {expiryLabel ?? "Messages disappear 24h after chat is accepted"}
        </span>
      </div>

      {/* Messages */}
      <div className={cn("flex-1 overflow-y-auto px-4 py-4 pb-2 space-y-1", (isBlocked || blockedByThem) && "opacity-40 pointer-events-none")}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100/60">
              {partner.avatar_url ? (
                <Image src={partner.avatar_url} alt="" width={64} height={64} className="rounded-2xl object-cover" />
              ) : (
                <span className="text-2xl font-bold text-slate-500">
                  {partner.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold text-slate-800">@{partner.username}</p>
            <p className="text-[12px] text-slate-400">This is the beginning of your conversation.</p>
          </div>
        ) : (
          groups.map((item, i) =>
            item.type === "separator" ? (
              <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[11px] text-slate-300">{item.label}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            ) : (
              <MessageBubble
                key={item.msg.id}
                msg={item.msg}
                isMine={item.msg.senderId === user?.id}
              />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {blockedByThem ? (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2 text-[13px] text-slate-400">
            <ShieldBan size={14} />
            <span>You can no longer message this user.</span>
          </div>
        </div>
      ) : isBlocked ? (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-center gap-2 text-[13px] text-slate-400">
            <ShieldBan size={14} />
            <span>You blocked this user.</span>
            <button
              onClick={handleBlockClick}
              className="font-semibold text-pink-500 hover:text-pink-400"
            >
              Unblock
            </button>
          </div>
        </div>
      ) : (
        <div className="sticky bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
          {uploading && (
            <div className="flex items-center gap-2 px-1 pb-2 text-[12px] text-pink-500">
              <Loader2 size={12} className="animate-spin" />
              <span>Uploading...</span>
            </div>
          )}
          {canSendLocked && lockArmed && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-pink-200 bg-pink-50/50 px-3 py-2">
              <Lock size={13} className="text-pink-500" />
              <span className="text-[12px] text-slate-600">Next photo is locked —</span>
              <span className="text-[12px] font-semibold text-pink-500">CA$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={lockPrice}
                onChange={(e) => setLockPrice(e.target.value)}
                placeholder="price"
                className="w-16 bg-transparent text-[13px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
              />
              <button onClick={() => { setLockArmed(false); setLockPrice(""); }} className="ml-auto text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-gray-100 hover:text-slate-600 disabled:opacity-40"
            >
              <ImagePlus size={20} />
            </button>
            {canSendLocked && (
              <button
                onClick={() => setLockArmed((v) => !v)}
                disabled={uploading}
                title="Send a locked, pay-per-view photo"
                className={cn(
                  "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition disabled:opacity-40",
                  lockArmed ? "bg-pink-100 text-pink-500" : "text-slate-400 hover:bg-gray-100 hover:text-slate-600"
                )}
              >
                <Lock size={18} />
              </button>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-300 outline-none focus:border-pink-400/30 max-h-32 overflow-y-auto"
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending || uploading}
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition",
                input.trim() && !sending && !uploading
                  ? "bg-[rgb(246,51,154)] text-white hover:brightness-105"
                  : "bg-gray-100 text-slate-300 cursor-not-allowed"
              )}
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <p className="mt-1 text-right text-[10px] text-slate-300">{input.length}/2000</p>
        </div>
      )}

      {/* Block confirmation modal */}
      <AnimatePresence>
        {blockConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setBlockConfirmOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(85vw,320px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                  <ShieldBan size={24} className="text-red-400" />
                </div>
                <p className="text-[15px] font-semibold text-slate-800">Block @{partner.username}?</p>
                <p className="text-[13px] leading-relaxed text-slate-500">
                  They won&apos;t be able to send you message requests. You can unblock them later from Settings.
                </p>
                <div className="mt-2 flex w-full gap-3">
                  <button
                    onClick={() => setBlockConfirmOpen(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBlock}
                    disabled={blocking}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-[13px] font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                  >
                    {blocking ? "Blocking..." : "Block"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header (shared between no-channel and thread views)
// ---------------------------------------------------------------------------

function ThreadHeader({
  partner,
  menuOpen,
  setMenuOpen,
  isProvider,
  isBlocked,
  blocking,
  onBlockClick,
}: {
  partner: Profile;
  menuOpen?: boolean;
  setMenuOpen?: (v: boolean) => void;
  isProvider?: boolean;
  isBlocked?: boolean;
  blocking?: boolean;
  onBlockClick?: () => void;
}) {
  const router = useRouter();
  const isVerified = partner.verification_status === "verified";

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
      <button
        onClick={() => router.back()}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
      >
        <ChevronLeft size={20} />
      </button>

      <Link href={`/u/${partner.username}`} className="flex flex-1 items-center gap-2.5 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-gray-100">
            {partner.avatar_url ? (
              <Image src={partner.avatar_url} alt={partner.username} width={36} height={36} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-500">
                {partner.username[0].toUpperCase()}
              </div>
            )}
          </div>
          {isVerified && (
            <CheckCircle size={12} className="absolute -bottom-0.5 -right-0.5 fill-white text-pink-500" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-slate-800 truncate leading-tight">{partner.username}</p>
          {isVerified && <p className="text-[11px] text-pink-500 leading-none">Verified</p>}
        </div>
      </Link>

      {setMenuOpen && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <Link
                  href={`/u/${partner.username}`}
                  className="flex items-center gap-3 px-4 py-3 text-[13px] text-slate-600 transition hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <CheckCircle size={14} className="text-slate-400" />
                  View profile
                </Link>
                {isProvider && onBlockClick && (
                  <button
                    onClick={onBlockClick}
                    disabled={blocking}
                    className="flex w-full items-center gap-3 border-t border-gray-200 px-4 py-3 text-[13px] text-red-400 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    <ShieldBan size={14} />
                    {isBlocked ? "Unblock user" : "Block user"}
                  </button>
                )}
                <div className="border-t border-gray-200">
                  <ReportButton
                    targetType="profile"
                    targetId={partner.id}
                    className="w-full justify-start gap-3 px-4 py-3 text-[13px] text-red-400 hover:bg-gray-100"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Bubble
// ---------------------------------------------------------------------------

// Fetches a locked DM attachment's signed URL (entitlement-checked server-side).
function LockedDmImage({ messageId }: { messageId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    apiFetch(`/api/chat/attachment/${messageId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.url) setSrc(d.url); })
      .catch(() => {});
    return () => { active = false; };
  }, [messageId]);

  if (!src) {
    return (
      <div className="flex h-40 w-56 items-center justify-center rounded-xl bg-black/10">
        <Loader2 size={18} className="animate-spin text-white/70" />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="Unlocked" className="max-h-64 w-full rounded-xl object-cover" />;
}

function MessageBubble({
  msg,
  isMine,
}: {
  msg: ChatMessage;
  isMine: boolean;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hasText = msg.text && msg.text.length > 0;

  // Locked pay-per-view message the viewer hasn't unlocked.
  const lockedForViewer = msg.isLocked && !msg.unlocked && !isMine;
  if (lockedForViewer) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-pink-200 bg-pink-50/60 px-4 py-3">
          <div className="mb-2 flex items-center gap-2">
            <Lock size={15} className="text-pink-500" />
            <span className="text-[13px] font-semibold text-slate-700">Locked photo</span>
          </div>
          {hasText && <p className="mb-2 text-[13px] text-slate-600">{msg.text}</p>}
          <PayButton
            purpose="message"
            referenceId={msg.id}
            label={`Unlock · CA$${Math.round((msg.unlockPrice ?? 0) / 100)}`}
            className="px-4 py-2 text-[13px]"
          />
          <p className="mt-1.5 text-right text-[10px] text-slate-400">{formatTime(msg.createdAt)}</p>
        </div>
      </div>
    );
  }

  // Unlocked (or own) locked attachment → fetch the signed URL.
  if (msg.isLocked && msg.hasLockedAttachment) {
    return (
      <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
        <div className={cn(
          "max-w-[75%] overflow-hidden rounded-2xl",
          isMine ? "rounded-tr-sm bg-gradient-to-r from-pink-400 to-sky-400 p-1" : "rounded-tl-sm bg-gray-100 p-1"
        )}>
          <LockedDmImage messageId={msg.id} />
          {hasText && <p className={cn("px-3 py-1.5 text-[14px]", isMine ? "text-white" : "text-slate-800")}>{msg.text}</p>}
          <p className={cn("px-3 pb-1.5 text-right text-[10px]", isMine ? "text-white/60" : "text-slate-400")}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  const hasImage = msg.attachmentType === "image" && msg.attachmentUrl;
  const hasFile = msg.attachmentType === "file" && msg.attachmentUrl;

  return (
    <>
      <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[75%] rounded-2xl text-[14px] leading-snug overflow-hidden",
            isMine
              ? "rounded-tr-sm bg-gradient-to-r from-pink-400 to-sky-400 text-white"
              : "rounded-tl-sm bg-gray-100 text-slate-800",
            hasImage && !hasText ? "" : "px-4 py-2.5"
          )}
        >
          {hasImage && (
            <button onClick={() => setLightboxOpen(true)} className="block w-full text-left">
              <img
                src={msg.attachmentUrl!}
                alt="Attachment"
                className={cn(
                  "max-h-64 w-full object-cover cursor-zoom-in",
                  hasText ? "rounded-t-xl -mx-4 -mt-2.5 mb-2" : "rounded-xl"
                )}
                loading="lazy"
              />
            </button>
          )}
          {hasFile && (
            <a
              href={msg.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition hover:opacity-80",
                isMine
                  ? "border-white/30 text-white/90"
                  : "border-gray-200 text-slate-600"
              )}
            >
              <FileIcon size={16} className="flex-shrink-0" />
              <span className="truncate">Attachment</span>
            </a>
          )}
          {hasText && (
            <p className={cn("whitespace-pre-wrap break-words", hasImage && "px-4 pt-1")}>{msg.text}</p>
          )}
          <p
            className={cn(
              "mt-1 text-right text-[10px]",
              isMine ? "text-white/60" : "text-slate-400",
              hasImage && !hasText && "px-3 pb-2"
            )}
          >
            {formatTime(msg.createdAt)}
          </p>
        </div>
      </div>

      {/* Image lightbox */}
      <AnimatePresence>
        {lightboxOpen && hasImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <X size={20} />
            </button>
            <img
              src={msg.attachmentUrl!}
              alt="Attachment"
              className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
