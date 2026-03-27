"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, CheckCircle, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { BottomNav } from "@/components/ui/BottomNav";

type Conversation = {
  partner_id: string;
  partner_username: string;
  partner_avatar: string | null;
  partner_verified: boolean;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  is_mine: boolean; // last message sent by me
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return "now";
  if (mins  < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  if (days  < 7)  return `${days}d`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    loadConversations();
  }, [user, checked]);

  async function loadConversations() {
    if (!user) return;
    // Fetch last message per unique conversation partner
    const { data: msgs } = await supabase
      .from("messages")
      .select(`
        id, body, created_at, is_read,
        sender_id, recipient_id,
        sender:profiles!messages_sender_id_fkey ( id, username, avatar_url, verification_status ),
        recipient:profiles!messages_recipient_id_fkey ( id, username, avatar_url, verification_status )
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    if (!msgs) { setLoading(false); return; }

    // Deduplicate into conversations (keyed by partner id)
    const seen = new Map<string, Conversation>();
    for (const m of msgs) {
      const isMine = m.sender_id === user.id;
      const partner = isMine ? (m.recipient as { id: string; username: string; avatar_url: string | null; verification_status: string }) : (m.sender as { id: string; username: string; avatar_url: string | null; verification_status: string });
      if (!partner || seen.has(partner.id)) continue;
      seen.set(partner.id, {
        partner_id:       partner.id,
        partner_username: partner.username,
        partner_avatar:   partner.avatar_url,
        partner_verified: partner.verification_status === "verified",
        last_message:     m.body,
        last_message_at:  m.created_at,
        unread_count:     0, // will calculate below
        is_mine:          isMine,
      });
    }

    // Count unread per partner
    for (const m of msgs) {
      if (m.recipient_id === user.id && !m.is_read) {
        const conv = seen.get(m.sender_id);
        if (conv) conv.unread_count++;
      }
    }

    setConversations(Array.from(seen.values()));
    setLoading(false);
  }

  const filtered = search
    ? conversations.filter((c) => c.partner_username.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-[17px] font-bold text-white">Messages</span>
          {conversations.some((c) => c.unread_count > 0) && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-zinc-950">
              {conversations.reduce((a, c) => a + c.unread_count, 0)}
            </span>
          )}
        </div>
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2.5">
            <Search size={14} className="text-zinc-500 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/60">
            <MessageCircle size={32} className="text-zinc-600" />
          </div>
          <p className="text-[16px] font-semibold text-white">
            {search ? "No results" : "No messages yet"}
          </p>
          <p className="text-[13px] text-zinc-500">
            {search ? "Try a different name." : "Enquiries and direct messages will appear here."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {filtered.map((conv) => (
            <Link
              key={conv.partner_id}
              href={`/messages/${conv.partner_username}`}
              className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-zinc-900/60 active:bg-zinc-900"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800">
                  {conv.partner_avatar ? (
                    <Image src={conv.partner_avatar} alt={conv.partner_username} width={48} height={48} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
                      {conv.partner_username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                {conv.partner_verified && (
                  <CheckCircle size={14} className="absolute -bottom-0.5 -right-0.5 fill-zinc-950 text-amber-400" />
                )}
                {conv.unread_count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-950">
                    {conv.unread_count > 9 ? "9+" : conv.unread_count}
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn(
                    "text-[14px] truncate",
                    conv.unread_count > 0 ? "font-bold text-white" : "font-semibold text-white"
                  )}>
                    {conv.partner_username}
                  </p>
                  <span className="flex-shrink-0 text-[11px] text-zinc-600">
                    {timeAgo(conv.last_message_at)}
                  </span>
                </div>
                <p className={cn(
                  "text-[13px] truncate mt-0.5",
                  conv.unread_count > 0 ? "text-zinc-200 font-medium" : "text-zinc-500"
                )}>
                  {conv.is_mine && <span className="text-zinc-600">You: </span>}
                  {conv.last_message}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
