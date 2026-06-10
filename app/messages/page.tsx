"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle, Loader2, Search,
  Check, X, Clock, Pin, CheckCheck, Crown, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useSession } from "@/hooks/useSession";
import { useMessageRequests } from "@/hooks/useMessageRequests";
import { supabase } from "@/lib/supabase/client";
import { BottomNav } from "@/components/ui/BottomNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Conversation = {
  channelId: string;
  partnerId: string;
  partnerName: string;
  partnerImage: string | null;
  partnerIsProvider: boolean;
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

function timeAgo(iso: string, locale: string) {
  const isFr = locale === "fr";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return isFr ? "à l'instant" : "now";
  if (mins < 60) return isFr ? `Il y a ${mins}m` : `${mins}m ago`;
  if (hours < 24) return isFr ? `Il y a ${hours}h` : `${hours}h ago`;
  if (days === 1) return isFr ? "Hier" : "Yesterday";
  if (days < 7) return isFr ? `Il y a ${days}j` : `${days}d ago`;
  return new Date(iso).toLocaleDateString(isFr ? "fr-CA" : "en-CA", { month: "short", day: "numeric" });
}

// Proxy for "online" — last message within 15 minutes
function looksOnline(lastMessageAt: string): boolean {
  return Date.now() - new Date(lastMessageAt).getTime() < 15 * 60_000;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fafbfc]" />}>
      <MessagesPageInner />
    </Suspense>
  );
}

function MessagesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checked } = useSession();
  const { t, locale } = useTranslation();

  const initialTab = searchParams.get("tab") === "requests" ? "requests" : "conversations";
  const [tab, setTab] = useState<"conversations" | "requests">(initialTab);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Message requests — fetch both incoming and outgoing pending so escorts can
  // also see requests they've sent (e.g. to other escorts).
  const {
    requests: pendingRequests,
    loading: requestsLoading,
    accept,
    reject,
  } = useMessageRequests(user?.id ?? null, "all_pending");

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
        partner_is_provider: boolean | null;
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
        partnerIsProvider: row.partner_is_provider ?? false,
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

  // Tab badge counts only incoming (actionable) requests, not outgoing.
  const pendingCount = pendingRequests.filter((r) => r.recipient_id === user?.id).length;
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
        apiFetch("/api/chat/mark-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: c.channelId }),
        })
      )
    );

    window.dispatchEvent(new Event("unread-refresh"));
    setMarkingAllRead(false);
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      {/* ── Header: big pink title + tabs ── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl">
        <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-1">
          <div className="flex items-center justify-between">
            <h1 className="text-[28px] font-extrabold leading-none tracking-tight text-[rgb(246,51,154)]">
              {t("messages_title")}
            </h1>
            {hasUnread && tab === "conversations" && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAllRead}
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:border-pink-400/30 hover:text-pink-500 disabled:opacity-40"
              >
                <CheckCheck size={12} />
                {t("messages_mark_all_read")}
              </button>
            )}
          </div>
        </div>

        {/* Tabs — pill buttons */}
        <div className="flex gap-2 px-4 pt-3 pb-3">
          <button
            onClick={() => setTab("conversations")}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold transition-colors",
              tab === "conversations"
                ? "bg-[rgb(246,51,154)] text-white shadow-[0_6px_18px_-6px_rgba(246,51,154,0.55)]"
                : "bg-gray-100 text-slate-600 hover:text-slate-800"
            )}
          >
            {t("messages_tab_conversations")}
          </button>
          <button
            onClick={() => setTab("requests")}
            className={cn(
              "relative flex-1 rounded-xl py-2.5 text-[13.5px] font-semibold transition-colors",
              tab === "requests"
                ? "bg-[rgb(246,51,154)] text-white shadow-[0_6px_18px_-6px_rgba(246,51,154,0.55)]"
                : "bg-gray-100 text-slate-600 hover:text-slate-800"
            )}
          >
            {t("messages_tab_requests")}
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
          {/* Status Updates — horizontal avatar carousel with pink ring + plus badge */}
          {!loading && conversations.length > 0 && (
            <div className="pt-4">
              <h2 className="px-4 pb-2 text-[13px] font-bold text-slate-800">
                {t("messages_status_updates")}
              </h2>
              <div
                className="flex gap-4 overflow-x-auto px-4 pb-3"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {conversations.map((conv) => (
                  <Link
                    key={conv.channelId}
                    href={`/messages/${conv.partnerName}`}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="relative">
                      <div className="rounded-full p-[2px] ring-2 ring-[rgb(246,51,154)] bg-white transition-opacity hover:opacity-90">
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
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-slate-600">
                            {conv.partnerName[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(246,51,154)] text-white ring-2 ring-white">
                        <Plus size={11} strokeWidth={3} />
                      </span>
                    </div>
                    <span className="max-w-[68px] truncate text-[11px] font-medium text-slate-600">
                      {conv.partnerName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          {!loading && conversations.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <div className="flex items-center gap-2.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
                <Search size={15} className="text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("messages_search_ph")}
                  className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-400 outline-none"
                />
              </div>
            </div>
          )}

          {loading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 px-4 py-3.5">
                  <div className="h-12 w-12 flex-shrink-0 rounded-full bg-gray-100 shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded-full bg-gray-100 shimmer" />
                    <div className="h-3 w-48 rounded-full bg-gray-100/60 shimmer" />
                  </div>
                  <div className="h-3 w-8 rounded-full bg-gray-100 shimmer" />
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
            <div>
              <h2 className="px-4 pt-2 pb-2 text-[13px] font-bold text-slate-800">
                {t("messages_active_chats")}
              </h2>
              <div className="divide-y divide-gray-100">
                {filtered.map((conv) => (
                  <ConversationRow
                    key={conv.channelId}
                    conv={conv}
                    userId={user?.id ?? ""}
                    onTogglePin={() => handleTogglePin(conv)}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
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
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-4 py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 flex-shrink-0 rounded-full bg-gray-100 shimmer" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-24 rounded-full bg-gray-100 shimmer" />
                      <div className="h-2.5 w-16 rounded-full bg-gray-100/60 shimmer" />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-9 w-9 rounded-full bg-gray-100 shimmer" />
                      <div className="h-9 w-20 rounded-full bg-gray-100 shimmer" />
                    </div>
                  </div>
                  <div className="ml-14 h-3 w-3/4 rounded-full bg-gray-100/40 shimmer" />
                </div>
              ))}
            </div>
          ) : pendingRequests.length === 0 ? (
            <EmptyState variant="no-requests" />
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingRequests.map((req) => {
                const isIncoming = req.recipient_id === user?.id;
                const person = isIncoming ? req.sender : req.recipient;
                const isAccepting = acceptingId === req.id;
                const partnerIsProvider = person?.is_provider ?? false;

                return (
                  <div
                    key={req.id}
                    className="px-4 py-4 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-gray-100">
                        {person?.avatar_url ? (
                          <Image
                            src={person.avatar_url}
                            alt={person.username}
                            width={44}
                            height={44}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-500">
                            {person?.username?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[14px] font-semibold text-slate-800 truncate">
                            {person?.username ?? t("messages_unknown")}
                          </p>
                          {person?.verification_status === "verified" && (
                            <CheckCircle
                              size={12}
                              className="text-pink-500 fill-white flex-shrink-0"
                            />
                          )}
                          {partnerIsProvider && (
                            <ProviderBadge />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {isIncoming ? (
                            <>{timeAgo(req.created_at, locale)} · <span className="text-slate-500">{t("messages_wants_to_chat")}</span></>
                          ) : (
                            <>
                              {timeAgo(req.created_at, locale)}
                              <span className="ml-2 inline-flex items-center gap-1 text-pink-500">
                                <Clock size={10} /> {t("messages_awaiting_reply")}
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Actions for incoming requests */}
                      {isIncoming && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await reject(req.id);
                              window.dispatchEvent(new Event("unread-refresh"));
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-slate-500 transition hover:border-red-500/50 hover:text-red-400"
                          >
                            <X size={16} />
                          </button>
                          <button
                            onClick={() =>
                              handleAccept(req.id, person?.username ?? "")
                            }
                            disabled={isAccepting}
                            className="flex h-9 items-center gap-1.5 rounded-full bg-pink-400 px-4 text-[13px] font-semibold text-white transition hover:bg-pink-300 disabled:opacity-50"
                          >
                            {isAccepting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Check size={14} strokeWidth={2.5} />
                            )}
                            {t("messages_accept")}
                          </button>
                        </div>
                      )}

                      {/* Outgoing: link to view profile while waiting */}
                      {!isIncoming && person?.username && (
                        <Link
                          href={`/u/${person.username}`}
                          className="rounded-full border border-gray-200 px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:border-gray-300 hover:text-slate-700"
                        >
                          {t("messages_view")}
                        </Link>
                      )}
                    </div>

                    {/* Intro message preview */}
                    {req.intro_message && (
                      <p className="ml-14 text-[13px] leading-relaxed text-slate-500">
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
// Gold badge shown when the partner is a provider (escort)
// ---------------------------------------------------------------------------

function ProviderBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-gradient-to-r from-amber-50 to-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 flex-shrink-0">
      <Crown size={9} className="fill-amber-500 text-amber-600" />
      Pro
    </span>
  );
}

// ---------------------------------------------------------------------------
// Conversation row with long-press to pin
// ---------------------------------------------------------------------------

function ConversationRow({
  conv,
  userId,
  onTogglePin,
  t,
  locale,
}: {
  conv: Conversation;
  userId: string;
  onTogglePin: () => void;
  t: (k: import("@/lib/i18n/en").TranslationKey) => string;
  locale: string;
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
        className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-gray-50/60 active:bg-gray-50 select-none"
      >
        {/* Avatar with green online dot */}
        <div className="relative flex-shrink-0">
          <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100">
            {conv.partnerImage ? (
              <Image
                src={conv.partnerImage}
                alt={conv.partnerName}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-500">
                {conv.partnerName[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          {looksOnline(conv.lastMessageAt) && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {conv.isPinned && (
              <Pin size={10} className="flex-shrink-0 text-pink-500 fill-pink-500 -rotate-45" />
            )}
            <p
              className={cn(
                "text-[14.5px] truncate",
                conv.unreadCount > 0
                  ? "font-bold text-slate-900"
                  : "font-semibold text-slate-800"
              )}
            >
              {conv.partnerName}
            </p>
            {conv.partnerIsProvider && <ProviderBadge />}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {conv.isMine && (
              isRead ? (
                <CheckCheck size={14} className="flex-shrink-0 text-pink-500" />
              ) : (
                <Check size={14} className="flex-shrink-0 text-slate-300" />
              )
            )}
            <p
              className={cn(
                "text-[13px] truncate",
                conv.unreadCount > 0
                  ? "text-slate-700 font-medium"
                  : "text-slate-400"
              )}
            >
              {conv.lastMessage}
            </p>
          </div>
        </div>

        {/* Right column: timestamp + blue unread pill */}
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5 self-start pt-0.5">
          <span className="text-[11px] text-slate-400">
            {timeAgo(conv.lastMessageAt, locale)}
          </span>
          {conv.unreadCount > 0 && (
            conv.unreadCount <= 3 ? (
              <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                {conv.unreadCount === 1
                  ? t("messages_unread_one")
                  : t("messages_unread_many").replace("{n}", String(conv.unreadCount))}
              </span>
            ) : (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10.5px] font-bold text-white">
                {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
              </span>
            )
          )}
        </div>
      </Link>

      {/* Long-press context menu */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-4 z-50 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
            style={{ top: "50%", transform: "translateY(-50%)" }}
          >
            <button
              onClick={() => {
                setMenuOpen(false);
                onTogglePin();
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-slate-600 transition hover:bg-gray-100"
            >
              <Pin size={14} className={cn("-rotate-45", conv.isPinned && "text-pink-500 fill-pink-500")} />
              {conv.isPinned ? t("messages_unpin_chat") : t("messages_pin_chat")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
