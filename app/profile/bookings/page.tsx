"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, CheckCircle, Clock, XCircle, Calendar,
  MapPin, Loader2, Check, X, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Booking = {
  id: string;
  status: "pending" | "accepted" | "declined" | "completed" | "cancelled";
  requested_date: string;
  requested_time: string | null;
  duration_minutes: number | null;
  service_type: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
  listing_id: string | null;
  listings: { title: string } | null;
  client: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
};

const STATUS = {
  pending:   { label: "Pending",   color: "text-amber-400",   bg: "bg-amber-400/10",  icon: Clock },
  accepted:  { label: "Accepted",  color: "text-sky-400",     bg: "bg-sky-400/10",    icon: CheckCircle },
  declined:  { label: "Declined",  color: "text-zinc-500",    bg: "bg-zinc-700/30",   icon: XCircle },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/10",icon: Star },
  cancelled: { label: "Cancelled", color: "text-zinc-500",    bg: "bg-zinc-700/30",   icon: XCircle },
};

const TABS = ["pending", "accepted", "completed", "all"] as const;
type Tab = typeof TABS[number];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function ProviderBookingsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>("pending");
  const [acting, setActing]     = useState<string | null>(null);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    load();
  }, [user, checked]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bookings")
      .select(`
        id, status, requested_date, requested_time, duration_minutes,
        service_type, area, notes, created_at, listing_id,
        listings ( title ),
        client:profiles!bookings_client_id_fkey ( id, username, avatar_url )
      `)
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false });
    setBookings((data as unknown as Booking[]) ?? []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: Booking["status"], extra?: Record<string, unknown>) {
    setActing(id);
    const patch: Record<string, unknown> = { status, ...extra };
    if (status === "accepted")  patch.accepted_at  = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    if (status === "cancelled") { patch.cancelled_at = new Date().toISOString(); patch.cancelled_by = user?.id; }

    const { error } = await supabase.from("bookings").update(patch).eq("id", id);
    setActing(null);
    if (error) { showToast("Action failed. Try again.", false); return; }

    setBookings((prev) => prev.map((b) => b.id === id ? { ...b, status, ...patch } : b));
    const msgs: Record<string, string> = {
      accepted: "Booking accepted",
      declined: "Booking declined",
      completed: "Marked as completed — client can now leave a review",
      cancelled: "Booking cancelled",
    };
    showToast(msgs[status] ?? "Updated", true);
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = bookings.filter((b) => tab === "all" || b.status === tab);

  const counts: Record<string, number> = { pending: 0, accepted: 0, completed: 0, all: bookings.length };
  for (const b of bookings) if (b.status in counts) counts[b.status]++;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Bookings</span>
        {counts.pending > 0 && (
          <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-zinc-950">
            {counts.pending}
          </span>
        )}
      </header>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition capitalize",
              tab === t
                ? "bg-white text-zinc-950"
                : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t}{counts[t] > 0 && t !== "all" ? ` (${counts[t]})` : t === "all" ? ` (${counts.all})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center pt-20">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center px-8">
          <Calendar size={32} className="text-zinc-700" />
          <p className="text-[15px] font-semibold text-white">
            {tab === "pending" ? "No pending requests" : `No ${tab} bookings`}
          </p>
          <p className="text-[13px] text-zinc-500">
            {tab === "pending" ? "New booking requests will appear here." : "They'll show up here once created."}
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg space-y-3 px-4 pt-2">
          {filtered.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              acting={acting === booking.id}
              onAccept={() => updateStatus(booking.id, "accepted")}
              onDecline={() => updateStatus(booking.id, "declined")}
              onComplete={() => updateStatus(booking.id, "completed")}
              onCancel={() => updateStatus(booking.id, "cancelled")}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
            className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-medium shadow-xl z-50 max-w-xs text-center",
              toast.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white")}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BookingCard({
  booking, acting, onAccept, onDecline, onComplete, onCancel,
}: {
  booking: Booking;
  acting: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const cfg = STATUS[booking.status];
  const StatusIcon = cfg.icon;
  const client = booking.client;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
      {/* Header: client + status */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <Link href={client ? `/u/${client.username}` : "#"} className="flex items-center gap-3">
          <div className="h-9 w-9 overflow-hidden rounded-full bg-zinc-800 flex-shrink-0">
            {client?.avatar_url ? (
              <Image src={client.avatar_url} alt={client.username} width={36} height={36} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
                {client?.username?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">@{client?.username ?? "unknown"}</p>
            <p className="text-[11px] text-zinc-500">{timeAgo(booking.created_at)}</p>
          </div>
        </Link>
        <span className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold", cfg.bg, cfg.color)}>
          <StatusIcon size={11} />
          {cfg.label}
        </span>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        {booking.listings?.title && (
          <p className="text-[12px] font-medium text-amber-400 truncate">{booking.listings.title}</p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[13px] text-zinc-300">
            <Calendar size={13} className="text-zinc-500" />
            {new Date(booking.requested_date).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
            {booking.requested_time && <span className="text-zinc-500">· {booking.requested_time}</span>}
          </span>
          {booking.duration_minutes && (
            <span className="flex items-center gap-1.5 text-[13px] text-zinc-300">
              <Clock size={13} className="text-zinc-500" />
              {booking.duration_minutes >= 60
                ? `${Math.floor(booking.duration_minutes / 60)}h${booking.duration_minutes % 60 ? ` ${booking.duration_minutes % 60}m` : ""}`
                : `${booking.duration_minutes}m`}
            </span>
          )}
          {booking.service_type && (
            <span className="text-[13px] text-zinc-300 capitalize">{booking.service_type}</span>
          )}
          {booking.area && (
            <span className="flex items-center gap-1 text-[13px] text-zinc-400">
              <MapPin size={11} className="text-zinc-600" />{booking.area}
            </span>
          )}
        </div>
        {booking.notes && (
          <p className="rounded-xl bg-zinc-800/50 px-3 py-2 text-[12px] text-zinc-400 leading-relaxed">
            {booking.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      {acting ? (
        <div className="flex items-center justify-center border-t border-white/5 py-3">
          <Loader2 size={18} className="animate-spin text-zinc-500" />
        </div>
      ) : booking.status === "pending" ? (
        <div className="flex gap-2 border-t border-white/5 px-4 py-3">
          <button onClick={onDecline} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-[13px] font-semibold text-zinc-400 transition hover:bg-zinc-800">
            <X size={14} /> Decline
          </button>
          <button onClick={onAccept} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-zinc-200">
            <Check size={14} /> Accept
          </button>
        </div>
      ) : booking.status === "accepted" ? (
        <div className="flex gap-2 border-t border-white/5 px-4 py-3">
          <button onClick={onCancel} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-[13px] font-medium text-zinc-500 transition hover:bg-zinc-800">
            Cancel
          </button>
          <button onClick={onComplete} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-400">
            <Star size={14} /> Mark Completed
          </button>
        </div>
      ) : booking.status === "completed" ? (
        <div className="flex items-center gap-2 border-t border-white/5 px-4 py-3">
          <CheckCircle size={14} className="text-emerald-400" />
          <p className="text-[12px] text-zinc-500">Client has been prompted to leave a review.</p>
        </div>
      ) : null}
    </div>
  );
}
