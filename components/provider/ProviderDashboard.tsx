"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle, Clock, Calendar, MessageCircle,
  Zap, ListOrdered, Star, ChevronRight,
  ImagePlus, Eye, Check, X, Loader2, TrendingUp,
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
  reviewCount: number;
  averageRating: number | null;
  listingsCount: number;
  isAvailableNow: boolean;
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ProviderDashboard() {
  const router = useRouter();
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

    const [
      pendingResult,
      acceptedResult,
      profileResult,
      listingsResult,
    ] = await Promise.all([
      // Pending booking requests — show up to 3 on dashboard
      supabase
        .from("bookings")
        .select(
          `id, requested_date, requested_time, service_type, area, notes, created_at,
           client:profiles!bookings_client_id_fkey(id, username, avatar_url)`
        )
        .eq("provider_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true }) // oldest first — fairness
        .limit(3),

      // Accepted bookings count
      supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", user.id)
        .eq("status", "accepted"),

      // Profile stats (completed bookings, reviews, availability)
      supabase
        .from("profiles")
        .select("completed_bookings_count, review_count, average_rating, available_until")
        .eq("id", user.id)
        .single(),

      // Active listings count
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", user.id)
        .eq("is_active", true),
    ]);

    setPendingBookings((pendingResult.data ?? []) as unknown as PendingBooking[]);

    const p = profileResult.data;
    const isAvailNow = p?.available_until
      ? new Date(p.available_until) > new Date()
      : false;

    setStats({
      pendingCount: pendingResult.data?.length ?? 0,
      acceptedCount: acceptedResult.count ?? 0,
      completedCount: p?.completed_bookings_count ?? 0,
      reviewCount: p?.review_count ?? 0,
      averageRating: p?.average_rating ?? null,
      listingsCount: listingsResult.count ?? 0,
      isAvailableNow: isAvailNow,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Accept / decline a pending booking directly from the dashboard
  async function handleBookingAction(bookingId: string, status: "accepted" | "declined") {
    setActingOn(bookingId);
    const patch: Record<string, unknown> = { status };
    if (status === "accepted") patch.accepted_at = new Date().toISOString();

    await supabase.from("bookings").update(patch).eq("id", bookingId);
    setActingOn(null);

    // Remove from pending list, update count
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

  // Toggle Available Now (sets available_until to +4h or clears it)
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

          {/* Availability toggle */}
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

        {/* ── Pending requests — urgent strip ── */}
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

        {/* ── Stats row ── */}
        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
            {t("dash_overview")}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {USE_BOOKINGS && (
              <>
                <StatCard
                  icon={Calendar}
                  label={t("dash_confirmed")}
                  value={String(stats.acceptedCount)}
                  sub={t("dash_upcoming")}
                  color="text-sky-400"
                  href="/profile/bookings"
                />
                <StatCard
                  icon={CheckCircle}
                  label={t("dash_completed")}
                  value={String(stats.completedCount)}
                  sub={t("dash_all_time")}
                  color="text-emerald-400"
                  href="/profile/bookings"
                />
              </>
            )}
            <StatCard
              icon={Star}
              label={t("dash_rating")}
              value={stats.averageRating ? Number(stats.averageRating).toFixed(1) : "—"}
              sub={stats.reviewCount > 0 ? `${stats.reviewCount} ${stats.reviewCount !== 1 ? t("dash_reviews_many") : t("dash_reviews_one")}` : t("dash_no_reviews")}
              color="text-amber-400"
              href={`/u/${profile.username}`}
            />
            <StatCard
              icon={ListOrdered}
              label={t("dash_listings")}
              value={String(stats.listingsCount)}
              sub={stats.listingsCount === 0 ? t("dash_add_first") : t("dash_active")}
              color="text-violet-400"
              href="/profile/listings"
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
              icon={Zap}
              label={t("dash_set_avail")}
              sub={t("dash_set_avail_sub")}
              href="/profile/availability"
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/10"
            />
            <QuickAction
              icon={ImagePlus}
              label={t("dash_upload")}
              sub={t("dash_upload_sub")}
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
              icon={Eye}
              label={t("dash_view_profile")}
              sub={t("dash_view_profile_sub")}
              href={`/u/${profile.username}`}
              iconColor="text-violet-400"
              iconBg="bg-violet-500/10"
            />
            <QuickAction
              icon={MessageCircle}
              label="Comments"
              sub="Review & approve"
              href="/profile/comments"
              iconColor="text-emerald-400"
              iconBg="bg-emerald-500/10"
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
            <p className="text-[12px] text-zinc-500">{t("dash_inbox")}</p>
          </div>
          <ChevronRight size={16} className="text-zinc-600" />
        </Link>

        {/* ── No pending — helpful nudge ── */}
        {USE_BOOKINGS && !hasPending && stats.pendingCount === 0 && (
          <div className="rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-5 text-center">
            <TrendingUp size={22} className="mx-auto mb-2 text-zinc-700" />
            <p className="text-[14px] font-semibold text-white">{t("dash_no_pending")}</p>
            <p className="mt-1 text-[12px] text-zinc-500">{t("dash_no_pending_sub")}</p>
            {stats.listingsCount === 0 && (
              <Link
                href="/profile/listings"
                className="mt-3 inline-block rounded-full bg-amber-400 px-5 py-2 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-300"
              >
                {t("dash_add_listing")}
              </Link>
            )}
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
      {/* Client + time */}
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

      {/* Details */}
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
            <span className="text-[12px] capitalize text-zinc-400">
              {booking.service_type}
            </span>
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

      {/* Actions */}
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
  icon: Icon, label, sub, href, iconColor, iconBg,
}: {
  icon: React.ElementType;
  label: string;
  sub: string;
  href: string;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4 transition-all hover:border-white/10 active:scale-[0.98]"
    >
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", iconBg)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-white leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500 leading-tight">{sub}</p>
      </div>
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
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
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
