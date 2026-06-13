"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle, MessageCircle, ChevronRight,
  ImagePlus, Eye, Loader2, TrendingUp,
  Heart, BarChart3, CreditCard, Coins, Users,
  Video, DollarSign,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { USE_LIVE_SHOWS, USE_CREATOR_CONTENT } from "@/lib/features";

// ─── Types ────────────────────────────────────────────────────────────────────

type CreatorStats = {
  postCredits: number;
  totalPostViews: number;
  totalLikes: number;
  postsCount: number;
  unreadMessages: number;
  pendingComments: number;
  subscribersCount: number;
  availableBalance: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greetingKey(): "dash_good_morning" | "dash_good_afternoon" | "dash_good_evening" {
  const h = new Date().getHours();
  if (h < 12) return "dash_good_morning";
  if (h < 17) return "dash_good_afternoon";
  return "dash_good_evening";
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatCurrency(cents: number): string {
  return `CA$${(cents / 100).toFixed(2)}`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CreatorDashboard() {
  const { user } = useSession();
  const { profile } = useProfile();
  const { t } = useTranslation();

  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    const [profileResult, postsResult, unreadResult, pendingCommentsResult, balanceResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("post_credits_balance, subscribers_count")
          .eq("id", user.id)
          .single(),

        supabase
          .from("status_updates")
          .select("views_count, likes_count")
          .eq("provider_id", user.id)
          .eq("post_type", "post"),

        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("is_read", false),

        supabase.rpc("count_pending_comments", { p_provider_id: user.id }),

        USE_CREATOR_CONTENT
          ? supabase
              .from("creator_balances")
              .select("available")
              .eq("creator_id", user.id)
              .single()
          : { data: null },
      ]);

    const p = profileResult.data;
    const posts = postsResult.data ?? [];
    const totalViews = posts.reduce((sum, post) => sum + (post.views_count ?? 0), 0);
    const totalLikes = posts.reduce((sum, post) => sum + (post.likes_count ?? 0), 0);

    setStats({
      postCredits: (p?.post_credits_balance as number) ?? 0,
      totalPostViews: totalViews,
      totalLikes: totalLikes,
      postsCount: posts.length,
      unreadMessages: unreadResult.count ?? 0,
      pendingComments: (pendingCommentsResult.data as number) ?? 0,
      subscribersCount: (p?.subscribers_count as number) ?? 0,
      availableBalance: (balanceResult.data as { available: number } | null)?.available ?? 0,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading || !profile || !stats) return <CreatorSkeleton />;

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-28">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-[#fafbfc]/90 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
              {t(greetingKey())}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <h1 className="text-[20px] font-bold text-slate-800">
                @{profile.username}
              </h1>
              {profile.verification_status === "verified" && (
                <CheckCircle size={15} className="fill-pink-100 text-pink-500" />
              )}
            </div>
          </div>
          <Link
            href="/profile/upload"
            className="flex items-center gap-2 rounded-full bg-[rgb(246,51,154)] px-4 py-2 text-[12px] font-bold text-white transition hover:brightness-105 active:scale-[0.97]"
          >
            <ImagePlus size={14} />
            {t("dash_upload")}
          </Link>
        </div>
      </header>

      <div className="space-y-6 px-4 pt-5">

        {/* ── Earnings banner (when creator content enabled) ── */}
        {USE_CREATOR_CONTENT && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link
              href="/profile/earnings"
              className="flex items-center justify-between rounded-2xl border border-pink-200 bg-gradient-to-r from-pink-50 to-transparent px-4 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50">
                  <DollarSign size={18} className="text-pink-500" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-500">{t("creator_available_balance")}</p>
                  <p className="text-[20px] font-bold text-pink-500">
                    {formatCurrency(stats.availableBalance)}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          </motion.div>
        )}

        {/* ── Credit balance banner ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50">
              <Coins size={18} className="text-pink-500" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {stats.postCredits} {stats.postCredits === 1 ? t("credits_credit") : t("credits_credits")}
              </p>
              <p className="text-[11px] text-slate-500">{t("credits_for_promotions")}</p>
            </div>
          </div>
          <Link
            href="/profile/packages"
            className="rounded-full bg-[rgb(246,51,154)] px-4 py-2 text-[12px] font-bold text-white transition hover:brightness-105 active:scale-[0.97]"
          >
            {t("credits_buy_more")}
          </Link>
        </motion.div>

        {/* ── Performance stats ── */}
        <section>
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-400">
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
              icon={Users}
              label={t("creator_subscribers")}
              value={formatCompact(stats.subscribersCount)}
              sub={t("creator_active_subs")}
              color="text-violet-400"
              href="/profile/earnings"
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
          <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-400">
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
              icon={Eye}
              label={t("dash_view_profile")}
              sub={t("dash_view_profile_sub")}
              href={`/u/${profile.username}`}
              iconColor="text-slate-500"
              iconBg="bg-gray-100"
            />
            {USE_CREATOR_CONTENT && (
              <QuickAction
                icon={DollarSign}
                label={t("creator_subscription_settings")}
                sub={t("creator_manage_tiers")}
                href="/profile/subscription"
                iconColor="text-pink-500"
                iconBg="bg-pink-50"
              />
            )}
            {USE_CREATOR_CONTENT && (
              <QuickAction
                icon={CreditCard}
                label={t("creator_earnings")}
                sub={formatCurrency(stats.availableBalance)}
                href="/profile/earnings"
                iconColor="text-emerald-400"
                iconBg="bg-emerald-500/10"
              />
            )}
            {USE_LIVE_SHOWS && (
              <QuickAction
                icon={Video}
                label={t("creator_go_live")}
                sub={t("creator_start_stream")}
                href="/live/new"
                iconColor="text-red-400"
                iconBg="bg-red-500/10"
              />
            )}
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
              icon={Coins}
              label="Buy Credits"
              sub={`${stats.postCredits} remaining`}
              href="/profile/packages"
              iconColor="text-pink-500"
              iconBg="bg-pink-50"
            />
          </div>
        </section>

        {/* ── Messages shortcut ── */}
        <Link
          href="/messages"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 transition-all hover:border-gray-200 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50">
            <MessageCircle size={18} className="text-pink-500" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-slate-800">{t("dash_messages")}</p>
            <p className="text-[12px] text-slate-500">
              {stats.unreadMessages > 0
                ? `${stats.unreadMessages} unread message${stats.unreadMessages !== 1 ? "s" : ""}`
                : t("dash_inbox")
              }
            </p>
          </div>
          {stats.unreadMessages > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-pink-400 px-1.5 text-[11px] font-bold text-white">
              {stats.unreadMessages > 99 ? "99+" : stats.unreadMessages}
            </span>
          )}
          <ChevronRight size={16} className="text-slate-400" />
        </Link>

        {/* ── Empty state nudge ── */}
        {stats.postsCount === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-center">
            <TrendingUp size={24} className="mx-auto mb-2 text-slate-300" />
            <p className="text-[15px] font-semibold text-slate-800">{t("creator_get_started")}</p>
            <p className="mt-1 text-[12px] text-slate-500">
              {t("creator_get_started_body")}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/profile/upload"
                className="rounded-full bg-[rgb(246,51,154)] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-105"
              >
                {t("creator_first_post")}
              </Link>
            </div>
          </div>
        )}

      </div>
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
      className="group flex flex-col gap-1 rounded-2xl border border-gray-200 bg-white px-4 py-4 transition-all hover:border-gray-200 active:scale-[0.98]"
    >
      <div className="flex items-center justify-between">
        <Icon size={14} className={color} />
        <ChevronRight size={12} className="text-slate-300 transition group-hover:text-slate-500" />
      </div>
      <p className="mt-1 text-[24px] font-bold leading-none text-slate-800">{value}</p>
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="text-[10px] text-slate-300">{sub}</p>
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
      className="relative flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 transition-all hover:border-gray-200 active:scale-[0.98]"
    >
      <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", iconBg)}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800 leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500 leading-tight">{sub}</p>
      </div>
      {badge != null && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-400 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CreatorSkeleton() {
  return (
    <div className="min-h-screen bg-[#fafbfc] pb-28 animate-pulse">
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="h-3 w-24 rounded-full bg-gray-100" />
        <div className="mt-2 h-6 w-36 rounded-full bg-gray-100" />
      </div>
      <div className="space-y-6 px-4 pt-5">
        <div className="h-20 rounded-2xl bg-white" />
        <div className="h-16 rounded-2xl bg-white" />
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  );
}
