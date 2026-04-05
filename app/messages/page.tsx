"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle, Loader2, Search,
  Check, X, Clock, Pin, CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { useMessageRequests } from "@/hooks/useMessageRequests";
import { supabase } from "@/lib/supabase/client";
import { BottomNav } from "@/components/ui/BottomNav";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Conversation = {
  channelId: string;
  partnerId: string;
  partnerName: string;
  partnerImage: string | null;
  lastMessage: string;
  lastMessageAt: string;
  lastSenderId: string;
  unreadCount: number;
  isMine: boolean;
  isPinned: boolean;
  partnerLastRead: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checked } = useSession();
  const { profile } = useProfile();

  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "conversations";
  const [tab, setTab] = useState<"conversations" | "requests">(initialTab);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Message requests
  const {
    requests: pendingRequests,
    loading: requestsLoading,
    accept,
    reject,
    refresh: refreshRequests,
  } = useMessageRequests(user?.id ?? null, profile?.is_provider ? "pending" : "sent");

  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked, router]);

  // Load conversations via Supabase RPC
  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase.rpc("get_conversations", {
      p_user_id: user.id,
    });

    if (error) {
      console.error("[messages] get_conversations error:", error);
      setLoading(false);
      return;
    }

    const convos: Conversation[] = (data ?? []).map(
      (row: {
        channel_id: string;
        partner_id: string;
        partner_name: string;
        partner_image: string | null;
        last_message: string | null;
        last_message_at: string | null;
        last_sender_id: string | null;
        unread_count: number;
        is_pinned: boolean;
        partner_last_read: string | null;
      }) => ({
        channelId: row.channel_id,
        partnerId: row.partner_id,
        partnerName: row.partner_name,
        partnerImage: row.partner_image,
        lastMessage: row.last_message ?? "",
        lastMessageAt: row.last_message_at ?? new Date().toISOString(),
        lastSenderId: row.last_sender_id ?? "",
        unreadCount: row.unread_count ?? 0,
        isMine: row.last_sender_id === user.id,
        isPinned: row.is_pinned ?? false,
        partnerLastRead: row.partner_last_read ?? null,
      })
    );

    setConversations(convos);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === "conversations") loadConversations();
  }, [tab, loadConversations]);

  // Live refresh when new messages arrive or read status changes
  useEffect(() => {
    if (!user || tab !== "conversations") return;

    const channel = supabase
      .channel("conversations-refresh")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => loadConversations()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_channel_members" },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, tab, loadConversations]);

  async function handleAccept(requestId: string, senderUsername: string) {
    setAcceptingId(requestId);
    setAcceptError(null);
    const result = await accept(requestId);
    setAcceptingId(null);
    if (result.ok) {
      // Immediately refresh unread badge in BottomNav
      window.dispatchEvent(new Event("unread-refresh"));
      router.push(`/messages/${senderUsername}`);
    } else {
      setAcceptError(result.error ?? "Failed to accept request. Please try again.");
      setTimeout(() => setAcceptError(null), 6000);
    }
  }

  async function handleTogglePin(conv: Conversation) {
    if (!user) return;

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.channelId === conv.channelId ? { ...c, isPinned: !c.isPinned } : c
      )
    );

    const { data, error } = await supabase.rpc("toggle_pin_chat", {
      p_channel_id: conv.channelId,
      p_user_id: user.id,
    });

    if (error || !(data as { success: boolean })?.success) {
      // Revert on failure
      setConversations((prev) =>
        prev.map((c) =>
          c.channelId === conv.channelId ? { ...c, isPinned: conv.isPinned } : c
        )
      );
    } else {
      // Reload for correct sort order
      loadConversations();
    }
  }

  const filtered = search
    ? conversations.filter((c) =>
        c.partnerName.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const pendingCount = pendingRequests.length;
  const hasUnread = conversations.some((c) => c.unreadCount > 0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  async function handleMarkAllRead() {
    if (!user || markingAllRead) return;
    setMarkingAllRead(true);

    const unreadConvos = conversations.filter((c) => c.unreadCount > 0);

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) => ({ ...c, unreadCount: 0 }))
    );

    await Promise.all(
      unreadConvos.map((c) =>
        fetch("/api/chat/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: c.channelId, userId: user.id }),
        })
      )
    );

    window.dispatchEvent(new Event("unread-refresh"));
    setMarkingAllRead(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[17px] font-bold text-white">Messages</span>
          {hasUnread && tab === "conversations" && (
            <button
              onClick={handleMarkAllRead}
              disabled={markingAllRead}
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-amber-400/30 hover:text-amber-400 disabled:opacity-40"
            >
              <CheckCheck size={12} />
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-2">
          <button
            onClick={() => setTab("conversations")}
            className={cn(
              "flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors",
              tab === "conversations"
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            )}
          >
            Conversations
          </button>
          <button
            onClick={() => setTab("requests")}
            className={cn(
              "flex-1 rounded-lg py-2 text-[13px] font-semibold transition-colors relative",
              tab === "requests"
                ? "bg-amber-400 text-zinc-950"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            )}
          >
            Requests
            {pendingCount > 0 && tab !== "requests" && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ── Conversations Tab ── */}
      {tab === "conversations" && (
        <>
          {/* Stories-style avatar bar */}
          {!loading && conversations.length > 0 && (
            <div className="border-b border-white/5">
              <div
                className="flex gap-4 overflow-x-auto px-4 py-3"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {conversations.map((conv) => (
                  <Link
                    key={conv.channelId}
                    href={`/messages/${conv.partnerName}`}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className={cn(
                      "rounded-full p-[2px] bg-gradient-to-tr transition-opacity hover:opacity-80",
                      conv.unreadCount > 0
                        ? "from-amber-500 via-amber-400 to-yellow-300"
                        : "from-zinc-600 via-zinc-500 to-zinc-400"
                    )}>
                      <div className="rounded-full p-[2px] bg-zinc-950">
                        {conv.partnerImage ? (
                          <div className="relative h-14 w-14 overflow-hidden rounded-full">
                            <Image
                              src={conv.partnerImage}
                              alt={conv.partnerName}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                        ) : (
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
                            {conv.partnerName[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="max-w-[60px] truncate text-[10px] text-zinc-400">
                      {conv.partnerName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {!loading && conversations.length > 0 && (
            <div className="px-4 py-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5">
                <Search size={14} className="text-zinc-500 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations..."
                  className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
                  <div className="h-12 w-12 flex-shrink-0 rounded-full bg-zinc-800 shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded-full bg-zinc-800 shimmer" />
                    <div className="h-3 w-48 rounded-full bg-zinc-800/60 shimmer" />
                  </div>
                  <div className="h-3 w-8 rounded-full bg-zinc-800 shimmer" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            search ? (
              <EmptyState variant="no-results" />
            ) : (
              <EmptyState variant="no-conversations" />
            )
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((conv) => (
                <ConversationRow
                  key={conv.channelId}
                  conv={conv}
                  userId={user?.id ?? ""}
                  onTogglePin={() => handleTogglePin(conv)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Requests Tab ── */}
      {tab === "requests" && (
        <>
          {acceptError && (
            <div className="mx-4 mt-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400">
              {acceptError}
            </div>
          )}
          {requestsLoading ? (
            <div className="divide-y divide-white/5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 flex-shrink-0 rounded-full bg-zinc-800 shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-24 rounded-full bg-zinc-800 shimmer" />
                      <div className="h-2.5 w-16 rounded-full bg-zinc-800/60 shimmer" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-9 rounded-full bg-zinc-800 shimmer" />
                      <div className="h-9 w-20 rounded-full bg-zinc-800 shimmer" />
                    </div>
                  </div>
                  <div className="ml-14 h-3 w-3/4 rounded-full bg-zinc-800/40 shimmer" />
                </div>
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <EmptyState variant="no-requests" />
          ) : (
            <div className="divide-y divide-white/5">
              {pendingRequests.map((req) => {
                const isProvider = profile?.is_provider;
                const person = isProvider ? req.sender : req.recipient;
                const isAccepting = acceptingId === req.id;

                return (
                  <div
                    key={req.id}
                    className="px-4 py-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
                        {person?.avatar_url ? (
                          <Image
                            src={person.avatar_url}
                            alt={person.username}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                            {person?.username?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-white truncate">
                          {person?.username ?? "Unknown"}
                          {person?.verification_status === "verified" && (
                            <CheckCircle
                              size={12}
                              className="inline ml-1 text-amber-400 fill-zinc-950"
                            />
                          )}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {timeAgo(req.created_at)}
                          {!isProvider && (
                            <span className="ml-2">
                              {req.status === "pending" && (
                                <span className="inline-flex items-center gap-1 text-amber-400">
                                  <Clock size={10} /> Pending
                                </span>
                              )}
                              {req.status === "accepted" && (
                                <span className="text-emerald-400">Accepted</span>
                              )}
                              {req.status === "rejected" && (
                                <span className="text-red-400">Declined</span>
                              )}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Actions (provider only, pending only) */}
                      {isProvider && req.status === "pending" && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await reject(req.id);
                              window.dispatchEvent(new Event("unread-refresh"));
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-red-500/50 hover:text-red-400"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleAccept(req.id, person?.username ?? "")
                            }
                            disabled={isAccepting}
                            className="flex h-9 items-center gap-1.5 rounded-full bg-amber-400 px-4 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
                          >
                            {isAccepting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} strokeWidth={2.5} />
                            )}
                            Accept
                          </button>
                        </div>
                      )}

                      {/* Client: go to chat if accepted */}
                      {!isProvider && req.status === "accepted" && (
                        <Link
                          href={`/messages/${person?.username}`}
                          className="rounded-full bg-amber-400 px-4 py-2 text-[13px] font-semibold text-zinc-950 hover:bg-amber-300"
                        >
                          Chat
                        </Link>
                      )}
                    </div>

                    {/* Intro message preview */}
                    {req.intro_message && (
                      <p className="ml-14 text-[13px] leading-relaxed text-zinc-400">
                        &ldquo;{req.intro_message}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversation row with long-press to pin
// ---------------------------------------------------------------------------

function ConversationRow({
  conv,
  userId,
  onTogglePin,
}: {
  conv: Conversation;
  userId: string;
  onTogglePin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const router = useRouter();

  const isRead =
    conv.isMine &&
    conv.partnerLastRead != null &&
    new Date(conv.partnerLastRead) >= new Date(conv.lastMessageAt);

  function startPress() {
    movedRef.current = false;
    timerRef.current = setTimeout(() => {
      setMenuOpen(true);
    }, 500);
  }

  function cancelPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleMove() {
    movedRef.current = true;
    cancelPress();
  }

  function handleClick(e: React.MouseEvent) {
    if (menuOpen) {
      e.preventDefault();
      return;
    }
  }

  return (
    <div className="relative">
      <Link
        href={`/messages/${conv.partnerName}`}
        onClick={handleClick}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={handleMove}
        className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-zinc-900/60 active:bg-zinc-900 select-none"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800">
            {conv.partnerImage ? (
              <Image
                src={conv.partnerImage}
                alt={conv.partnerName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                {conv.partnerName[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          {conv.unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-950">
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {conv.isPinned && (
                <Pin size={10} className="flex-shrink-0 text-amber-400 fill-amber-400 -rotate-45" />
              )}
              <p
                className={cn(
                  "text-[14px] truncate",
                  conv.unreadCount > 0
                    ? "font-bold text-white"
                    : "font-semibold text-white"
                )}
              >
                {conv.partnerName}
              </p>
            </div>
            <span className="flex-shrink-0 text-[11px] text-zinc-600">
              {timeAgo(conv.lastMessageAt)}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {conv.isMine && (
              isRead ? (
                <CheckCheck size={14} className="flex-shrink-0 text-amber-400" />
              ) : (
                <Check size={14} className="flex-shrink-0 text-zinc-600" />
              )
            )}
            <p
              className={cn(
                "text-[13px] truncate",
                conv.unreadCount > 0
                  ? "text-zinc-200 font-medium"
                  : "text-zinc-500"
              )}
            >
              {conv.lastMessage}
            </p>
          </div>
        </div>
      </Link>

      {/* Long-press context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 z-50 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                onTogglePin();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-zinc-300 transition hover:bg-zinc-800"
            >
              <Pin size={14} className={cn("-rotate-45", conv.isPinned && "text-amber-400 fill-amber-400")} />
              {conv.isPinned ? "Unpin chat" : "Pin chat"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
