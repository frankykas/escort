"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CheckCircle, Clock, Calendar, MessageCircle,
  Zap, ListOrdered, ChevronRight,
  ImagePlus, Eye, Check, X, Loader2, TrendingUp,
  Heart, BarChart3, CreditCard, ShieldCheck, Coins,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { USE_BOOKINGS } from "@/lib/features";

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingBooking = {
  id: string;
  requested_date: string;
  requested_time: string | null;
  service_type: string | null;
  area: string | null;
  notes: string | null;
  created_at: string;
  client: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
};

type DashboardStats = {
  pendingCount: number;
  acceptedCount: number;
  completedCount: number;
  listingsCount: number;
  liveListingsCount: number;
  isAvailableNow: boolean;
  postCredits: number;
  totalPostViews: number;
  totalLikes: number;
  postsCount: number;
  unreadMessages: number;
  pendingComments: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingKey(): "dash_good_morning" | "dash_good_afternoon" | "dash_good_evening" {
  const h = new Date().getHours();
  if (h < 12) return "dash_good_morning";
  if (h < 17) return "dash_good_afternoon";
  return "dash_good_evening";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-CA", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProviderDashboard() {
  const { user } = useSession();
  const { profile } = useProfile();
  const { t } = useTranslation();

  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [availToggling, setAvailToggling] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queries: PromiseLike<any>[] = [
      // Profile stats
      supabase
        .from("profiles")
        .select("completed_bookings_count, available_until, post_credits_balance")
        .eq("id", user.id)
        .single(),

      // Active listings count
      supabase
        .from("listings")
        .select("id, expires_at", { count: "exact" })
        .eq("provider_id", user.id)
        .eq("is_active", true),

      // Post stats (views + likes)
      supabase
        .from("status_updates")
        .select("views_count, likes_count")
        .eq("provider_id", user.id)
        .eq("post_type", "post"),

      // Unread messages
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false),

      // Pending comments
      supabase.rpc("count_pending_comments", { p_provider_id: user.id }),
    ];

    if (USE_BOOKINGS) {
      queries.push(
        supabase
          .from("bookings")
          .select(
            `id, requested_date, requested_time, service_type, area, notes, created_at,
             client:profiles!bookings_client_id_fkey(id, username, avatar_url)`
          )
          .eq("provider_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(3),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", user.id)
          .eq("status", "accepted"),
      );
    }

    const results = await Promise.all(queries);
    const profileResult = results[0] as { data: Record<string, unknown> | null };
    const listingsResult = results[1] as { data: { id: string; expires_at: string }[] | null; count: number | null };
    const postsResult = results[2] as { data: { views_count: number; likes_count: number }[] | null };
    const unreadResult = results[3] as { count: number | null };
    const pendingCommentsResult = results[4] as { data: number | null };

    const p = profileResult.data;
    const isAvailNow = p?.available_until
      ? new Date(p.available_until as string) > new Date()
      : false;

    const posts = postsResult.data ?? [];
    const totalViews = posts.reduce((sum, post) => sum + (post.views_count ?? 0), 0);
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count ?? 0), 0);

    // Count live listings (active + not expired)
    const now = new Date();
    const liveListings = (listingsResult.data ?? []).filter(
      (l) => new Date(l.expires_at) > now
    ).length;

    let pendingCount = 0;
    let acceptedCount = 0;
    if (USE_BOOKINGS && results.length > 5) {
      const pendingBookingsResult = results[5] as { data: PendingBooking[] | null };
      const acceptedResult = results[6] as { count: number | null };
      setPendingBookings((pendingBookingsResult.data ?? []) as unknown as PendingBooking[]);
      pendingCount = pendingBookingsResult.data?.length ?? 0;
      acceptedCount = acceptedResult.count ?? 0;
    }

    setStats({
      pendingCount,
      acceptedCount,
      completedCount: (p?.completed_bookings_count as number) ?? 0,
      listingsCount: listingsResult.count ?? 0,
      liveListingsCount: liveListings,
      isAvailableNow: isAvailNow,
      postCredits: (p?.post_credits_balance as number) ?? 0,
      totalPostViews: totalViews,
      totalLikes: totalLikes,
      postsCount: posts.length,
      unreadMessages: unreadResult.count ?? 0,
      pendingComments: (pendingCommentsResult.data as number) ?? 0,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleBookingAction(bookingId: string, status: "accepted" | "declined") {
    setActingOn(bookingId);
    const patch: Record<string, unknown> = { status };
    if (status === "accepted") patch.accepted_at = new Date().toISOString();
    await supabase.from("bookings").update(patch).eq("id", bookingId);
    setActingOn(null);
    setPendingBookings((prev) => prev.filter((b) => b.id !== bookingId));
    setStats((prev) =>
      prev
        ? {
            ...prev,
            pendingCount: Math.max(prev.pendingCount - 1, 0),
            acceptedCount: status === "accepted" ? prev.acceptedCount + 1 : prev.acceptedCount,
          }
        : prev
    );
  }

  async function toggleAvailability() {
    if (!user || availToggling) return;
    setAvailToggling(true);
    const isNowAvailable = stats?.isAvailableNow ?? false;
    const newValue = isNowAvailable
      ? null
      : new Date(Date.now() + 4 * 3600 * 1000).toISOString();

    await supabase
      .from("profiles")
      .update({ available_until: newValue })
      .eq("id", user.id);

    setStats((prev) => prev ? { ...prev, isAvailableNow: !isNowAvailable } : prev);
    setAvailToggling(false);
  }

  if (loading || !profile || !stats) return <DashboardSkeleton />;

  const hasPending = pendingBookings.length > 0;

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
              {t(greetingKey())}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <h1 className="text-[20px] font-bold text-white">
                @{profile.username}
              </h1>
              {profile.verification_status === "verified" && (
                <CheckCircle size={15} className="fill-amber-400/20 text-amber-400" />
              )}
            </div>
          </div>

          <button
            onClick={toggleAvailability}
            disabled={availToggling}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold transition-all",
              stats.isAvailableNow
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-white/10 bg-zinc-900 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
            )}
          >
            {availToggling ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  stats.isAvailableNow ? "animate-pulse bg-emerald-400" : "bg-zinc-600"
                )}
              />
            )}
            {stats.isAvailableNow ? t("dash_available") : t("dash_go_live")}
          </button>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-5">

        {/* ── Credit balance banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-amber-400/15 bg-gradient-to-r from-amber-400/5 to-transparent px-4 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
              <Coins size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">
                {stats.postCredits} {stats.postCredits === 1 ? "Credit" : "Credits"}
              </p>
              <p className="text-[11px] text-zinc-500">For posts &amp; listings</p>
            </div>
          </div>
          <Link
            href="/profile/packages"
            className="rounded-full bg-amber-400 px-4 py-2 text-[12px] font-bold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.97]"
          >
            Buy More
          </Link>
        </motion.div>

        {/* ── Pending requests — booking strip (only when USE_BOOKINGS) ── */}
        {USE_BOOKINGS && hasPending && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-zinc-950">
                  {stats.pendingCount}
                </span>
                <p className="text-[13px] font-semibold text-white">
                  {stats.pendingCount === 1 ? t("dash_pending_one") : t("dash_pending_many")}
                </p>
              </div>
              <Link
                href="/profile/bookings"
                className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {t("dash_view_all")}
              </Link>
            </div>
            <div className="space-y-2.5">
              {pendingBookings.map((booking) => (
                <PendingBookingCard
                  key={booking.id}
                  booking={booking}
                  acting={actingOn === booking.id}
                  onAccept={() => handleBookingAction(booking.id, "accepted")}
                  onDecline={() => handleBookingAction(booking.id, "declined")}
                />
              ))}
            </div>
          </motion.section>
        )}

        {/* ── Performance stats ── */}
        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            {t("dash_overview")}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              icon={Eye}
              label="Views"
              value={formatCompact(stats.totalPostViews)}
              sub="All time"
              color="text-sky-400"
              href={`/u/${profile.username}`}
            />
            <StatCard
              icon={Heart}
              label="Likes"
              value={formatCompact(stats.totalLikes)}
              sub={`${stats.postsCount} posts`}
              color="text-rose-400"
              href={`/u/${profile.username}`}
            />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <StatCard
              icon={ListOrdered}
              label={t("dash_listings")}
              value={String(stats.liveListingsCount)}
              sub={stats.listingsCount > stats.liveListingsCount
                ? `${stats.listingsCount - stats.liveListingsCount} expired`
                : stats.listingsCount === 0 ? t("dash_add_first") : t("dash_active")
              }
              color="text-violet-400"
              href="/profile/listings"
            />
            <StatCard
              icon={BarChart3}
              label="Posts"
              value={String(stats.postsCount)}
              sub="Feed posts"
              color="text-emerald-400"
              href="/profile/upload"
            />
          </div>
        </section>

        {/* ── Quick actions ── */}
        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            {t("dash_quick_actions")}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction
              icon={ImagePlus}
              label={t("dash_upload")}
              sub="Post or story"
              href="/profile/upload"
              iconColor="text-sky-400"
              iconBg="bg-sky-500/10"
            />
            <QuickAction
              icon={ListOrdered}
              label={t("dash_manage")}
              sub={t("dash_manage_sub")}
              href="/profile/listings"
              iconColor="text-amber-400"
              iconBg="bg-amber-400/10"
            />
            <QuickAction
              icon={MessageCircle}
              label="Comments"
              sub={stats.pendingComments > 0
                ? `${stats.pendingComments} pending`
                : "Review & approve"
              }
              href="/profile/comments"
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/10"
              badge={stats.pendingComments > 0 ? stats.pendingComments : undefined}
            />
            <QuickAction
              icon={Zap}
              label={t("dash_set_avail")}
              sub={t("dash_set_avail_sub")}
              href="/profile/availability"
              iconColor="text-violet-400"
              iconBg="bg-violet-500/10"
            />
            <QuickAction
              icon={Eye}
              label={t("dash_view_profile")}
              sub={t("dash_view_profile_sub")}
              href={`/u/${profile.username}`}
              iconColor="text-zinc-400"
              iconBg="bg-zinc-800"
            />
            <QuickAction
              icon={CreditCard}
              label="Buy Credits"
              sub={`${stats.postCredits} remaining`}
              href="/profile/packages"
              iconColor="text-amber-400"
              iconBg="bg-amber-400/10"
            />
          </div>
        </section>

        {/* ── Messages shortcut ── */}
        <Link
          href="/messages"
          className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4 transition-all hover:border-white/10 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10">
            <MessageCircle size={18} className="text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-white">{t("dash_messages")}</p>
            <p className="text-[12px] text-zinc-500">
              {stats.unreadMessages > 0
                ? `${stats.unreadMessages} unread message${stats.unreadMessages !== 1 ? "s" : ""}`
                : t("dash_inbox")
              }
            </p>
          </div>
          {stats.unreadMessages > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-zinc-950">
              {stats.unreadMessages > 99 ? "99+" : stats.unreadMessages}
            </span>
          )}
          <ChevronRight size={16} className="text-zinc-600" />
        </Link>

        {/* ── Empty state nudge ── */}
        {stats.postsCount === 0 && stats.listingsCount === 0 && (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-6 text-center">
            <TrendingUp size={24} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[15px] font-semibold text-white">Get started</p>
            <p className="mt-1 text-[12px] text-zinc-500">
              Create your first post or listing to start getting noticed.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/profile/upload"
                className="rounded-full bg-amber-400 px-5 py-2.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                Create Post
              </Link>
              <Link
                href="/profile/listings"
                className="rounded-full border border-white/10 px-5 py-2.5 text-[13px] font-semibold text-zinc-300 transition hover:border-white/20"
              >
                Add Listing
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Pending Booking Card ─────────────────────────────────────────────────────

function PendingBookingCard({
  booking, acting, onAccept, onDecline,
}: {
  booking: PendingBooking;
  acting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const client = booking.client;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/20 bg-zinc-900">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
          {client?.avatar_url ? (
            <Image
              src={client.avatar_url}
              alt={client.username}
              width={36} height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-400">
              {client?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">
            @{client?.username ?? "unknown"}
          </p>
          <p className="text-[11px] text-zinc-500">{timeAgo(booking.created_at)}</p>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1">
          <Clock size={10} className="text-amber-400" />
          <span className="text-[10px] font-semibold text-amber-400">{t("dash_pending_badge")}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span className="flex items-center gap-1.5 text-[12px] text-zinc-300">
            <Calendar size={11} className="text-zinc-500" />
            {formatDate(booking.requested_date)}
            {booking.requested_time && (
              <span className="text-zinc-500">· {booking.requested_time}</span>
            )}
          </span>
          {booking.service_type && (
            <span className="text-[12px] capitalize text-zinc-400">{booking.service_type}</span>
          )}
          {booking.area && (
            <span className="text-[12px] text-zinc-500">{booking.area}</span>
          )}
        </div>
        {booking.notes && (
          <p className="mt-2 line-clamp-2 rounded-xl bg-zinc-800/50 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
            {booking.notes}
          </p>
        )}
      </div>

      {acting ? (
        <div className="flex items-center justify-center border-t border-white/5 py-3">
          <Loader2 size={16} className="animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="flex gap-2 border-t border-white/5 px-4 py-3">
          <button
            onClick={onDecline}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2.5 text-[12px] font-semibold text-zinc-400 transition hover:bg-zinc-800"
          >
            <X size={13} /> {t("dash_decline")}
          </button>
          <button
            onClick={onAccept}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[12px] font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            <Check size={13} /> {t("dash_accept")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4 transition-all hover:border-white/10 active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <Icon size={14} className={color} />
        <ChevronRight size={12} className="text-zinc-700 transition group-hover:text-zinc-500" />
      </div>
      <p className="mt-1 text-[24px] font-bold leading-none text-white">{value}</p>
      <p className="text-[11px] font-medium text-zinc-500">{label}</p>
      <p className="text-[10px] text-zinc-700">{sub}</p>
    </Link>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────

function QuickAction({
  icon: Icon, label, sub, href, iconColor, iconBg, badge,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  href: string;
  iconColor: string;
  iconBg: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4 transition-all hover:border-white/10 active:scale-[0.98]"
    >
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", iconBg)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500 leading-tight">{sub}</p>
      </div>
      {badge != null && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-zinc-950">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-28 animate-pulse">
      <div className="border-b border-white/5 px-5 py-4">
        <div className="h-3 w-24 rounded-full bg-zinc-800" />
        <div className="mt-2 h-6 w-36 rounded-full bg-zinc-800" />
      </div>
      <div className="space-y-6 px-4 pt-5">
        <div className="h-16 rounded-2xl bg-zinc-900" />
        <div className="grid grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-zinc-900" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-zinc-900" />
          ))}
        </div>
      </div>
    </div>
  );
}
