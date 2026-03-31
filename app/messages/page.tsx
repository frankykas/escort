"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  MessageCircle, CheckCircle, Loader2, Search,
  Check, X, Clock, Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { useStreamChat } from "@/contexts/StreamChatContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useMessageRequests } from "@/hooks/useMessageRequests";
import { BottomNav } from "@/components/ui/BottomNav";
import type { Channel } from "stream-chat";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Conversation = {
  partnerId: string;
  partnerName: string;
  partnerImage: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isMine: boolean;
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
  const { client, ready } = useStreamChat();

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

  // Load Stream conversations
  const loadConversations = useCallback(async () => {
    if (!client || !ready || !user) return;
    setLoading(true);

    const channels = await client.queryChannels(
      { type: "messaging", members: { $in: [user.id] } },
      { last_message_at: -1 },
      { limit: 30 }
    );

    const convos: Conversation[] = channels.map((channel: Channel) => {
      const members = Object.values(channel.state.members).filter(
        (m) => m.user_id !== user.id
      );
      const partner = members[0]?.user;
      const lastMsg = channel.state.messages[channel.state.messages.length - 1];

      return {
        partnerId: partner?.id ?? "",
        partnerName: (partner?.name as string) ?? "Unknown",
        partnerImage: (partner?.image as string) ?? null,
        lastMessage: lastMsg?.text ?? "",
        lastMessageAt: lastMsg?.created_at
          ? new Date(lastMsg.created_at).toISOString()
          : new Date().toISOString(),
        unreadCount: channel.countUnread(),
        isMine: lastMsg?.user?.id === user.id,
      };
    });

    setConversations(convos);
    setLoading(false);
  }, [client, ready, user]);

  useEffect(() => {
    if (tab === "conversations") loadConversations();
  }, [tab, loadConversations]);

  // Listen for new messages to refresh the list
  useEffect(() => {
    if (!client || !ready) return;
    const handler = () => loadConversations();
    client.on("message.new", handler);
    client.on("notification.message_new", handler);
    return () => {
      client.off("message.new", handler);
      client.off("notification.message_new", handler);
    };
  }, [client, ready, loadConversations]);

  async function handleAccept(requestId: string, senderUsername: string) {
    setAcceptingId(requestId);
    setAcceptError(null);
    const result = await accept(requestId);
    setAcceptingId(null);
    if (result.ok) {
      router.push(`/messages/${senderUsername}`);
    } else {
      setAcceptError(result.error ?? "Failed to accept request. Please try again.");
      setTimeout(() => setAcceptError(null), 6000);
    }
  }

  const filtered = search
    ? conversations.filter((c) =>
        c.partnerName.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const pendingCount = pendingRequests.length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-[17px] font-bold text-white">Messages</span>
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

        {/* Search (conversations tab only) */}
        {tab === "conversations" && (
          <div className="px-4 pb-3">
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
      </header>

      {/* ── Conversations Tab ── */}
      {tab === "conversations" && (
        <>
          {loading || !ready ? (
            <div className="flex items-center justify-center pt-24">
              <Loader2 size={24} className="animate-spin text-zinc-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/60">
                <MessageCircle size={32} className="text-zinc-600" />
              </div>
              <p className="text-[16px] font-semibold text-white">
                {search ? "No results" : "No conversations yet"}
              </p>
              <p className="text-[13px] text-zinc-500">
                {search
                  ? "Try a different name."
                  : "When a message request is accepted, your conversation will appear here."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((conv) => (
                <Link
                  key={conv.partnerId}
                  href={`/messages/${conv.partnerName}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-zinc-900/60 active:bg-zinc-900"
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
                    <div className="flex items-baseline justify-between gap-2">
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
                      <span className="flex-shrink-0 text-[11px] text-zinc-600">
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[13px] truncate mt-0.5",
                        conv.unreadCount > 0
                          ? "text-zinc-200 font-medium"
                          : "text-zinc-500"
                      )}
                    >
                      {conv.isMine && (
                        <span className="text-zinc-600">You: </span>
                      )}
                      {conv.lastMessage}
                    </p>
                  </div>
                </Link>
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
            <div className="flex items-center justify-center pt-24">
              <Loader2 size={24} className="animate-spin text-zinc-600" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/60">
                <Inbox size={32} className="text-zinc-600" />
              </div>
              <p className="text-[16px] font-semibold text-white">
                {profile?.is_provider ? "No pending requests" : "No sent requests"}
              </p>
              <p className="text-[13px] text-zinc-500">
                {profile?.is_provider
                  ? "Message requests from clients will appear here."
                  : "When you send a message request, it will appear here."}
              </p>
            </div>
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
                            onClick={() => reject(req.id)}
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
