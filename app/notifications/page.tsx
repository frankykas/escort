"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Bell, CheckCheck, Heart, MessageCircle,
  UserPlus, ArrowLeft, Loader2, Sparkles, Mail, MapPin,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useNotifications } from "@/hooks/useNotifications";
import { getNotificationRoute } from "@/lib/notifications";
import { USE_BOOKINGS } from "@/lib/features";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Notification, NotificationType } from "@/lib/notifications";
import type { TranslationKey } from "@/lib/i18n/en";

// ─── Type → icon + tint + category/action labels ─────────────────────────────

type TypeStyle = {
  icon: React.ElementType;
  tint: string;
  fg: string;
  ring: string;
  category: TranslationKey;
  action?: TranslationKey;
};

const TYPE_STYLES: Record<NotificationType, TypeStyle> = {
  booking_requested: { icon: MapPin,        tint: "bg-sky-50",     fg: "text-sky-500",     ring: "ring-sky-100",     category: "notif_cat_booking",   action: "notif_action_view_booking" },
  booking_accepted:  { icon: MapPin,        tint: "bg-emerald-50", fg: "text-emerald-500", ring: "ring-emerald-100", category: "notif_cat_booking",   action: "notif_action_view_booking" },
  booking_declined:  { icon: MapPin,        tint: "bg-rose-50",    fg: "text-rose-500",    ring: "ring-rose-100",    category: "notif_cat_booking",   action: "notif_action_view_booking" },
  booking_completed: { icon: MapPin,        tint: "bg-pink-50",    fg: "text-pink-500",    ring: "ring-pink-100",    category: "notif_cat_booking",   action: "notif_action_view_booking" },
  booking_cancelled: { icon: MapPin,        tint: "bg-slate-50",   fg: "text-slate-500",   ring: "ring-slate-100",   category: "notif_cat_booking",   action: "notif_action_view_booking" },
  new_follower:      { icon: UserPlus,      tint: "bg-violet-50",  fg: "text-violet-500",  ring: "ring-violet-100",  category: "notif_cat_follower",  action: "notif_action_view_profile" },
  new_subscriber:    { icon: Sparkles,      tint: "bg-pink-50",    fg: "text-pink-500",    ring: "ring-pink-100",    category: "notif_cat_subscriber",action: "notif_action_view_profile" },
  post_liked:        { icon: Heart,         tint: "bg-pink-50",    fg: "text-pink-500",    ring: "ring-pink-100",    category: "notif_cat_like" },
  post_commented:    { icon: MessageCircle, tint: "bg-sky-50",     fg: "text-sky-500",     ring: "ring-sky-100",     category: "notif_cat_comment",   action: "notif_action_view_post" },
  new_message:       { icon: MessageCircle, tint: "bg-emerald-50", fg: "text-emerald-500", ring: "ring-emerald-100", category: "notif_cat_message",   action: "notif_action_open_chat" },
  message_request:           { icon: Bell,        tint: "bg-pink-50",    fg: "text-pink-500",    ring: "ring-pink-100",    category: "notif_cat_request",   action: "notif_action_open_chat" },
  message_request_accepted:  { icon: Bell,        tint: "bg-emerald-50", fg: "text-emerald-500", ring: "ring-emerald-100", category: "notif_cat_message",   action: "notif_action_open_chat" },
};

const SOCIAL_TYPES: NotificationType[] = ["post_liked", "post_commented", "new_follower", "new_subscriber"];
const MESSAGE_TYPES: NotificationType[] = ["new_message", "message_request", "message_request_accepted"];
const BOOKING_TYPES: NotificationType[] = [
  "booking_requested", "booking_accepted", "booking_declined",
  "booking_completed", "booking_cancelled",
];

type TabKey = "all" | "unread" | "social" | "messages" | "bookings";

// ─── Time grouping ───────────────────────────────────────────────────────────

type GroupKey = "today" | "yesterday" | "this_week" | "earlier";

function groupOf(dateStr: string): GroupKey {
  const d = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOfThisWeek = startOfToday - 6 * 86_400_000;
  const t = d.getTime();
  if (t >= startOfToday) return "today";
  if (t >= startOfYesterday) return "yesterday";
  if (t >= startOfThisWeek) return "this_week";
  return "earlier";
}

const GROUP_LABELS: Record<GroupKey, TranslationKey> = {
  today:     "notif_group_today",
  yesterday: "notif_group_yesterday",
  this_week: "notif_group_this_week",
  earlier:   "notif_group_earlier",
};

const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "this_week", "earlier"];

function relTime(dateStr: string, locale: string): string {
  const isFr = locale === "fr";
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60)       return isFr ? "à l'instant" : "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60)           return isFr ? `Il y a ${min}m` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)            return isFr ? `Il y a ${hr}h` : `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7)           return isFr ? `Il y a ${days}j` : `${days}d ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return isFr ? `Il y a ${weeks}sem` : `${weeks}w ago`;
  }
  return new Date(dateStr).toLocaleDateString(isFr ? "fr-CA" : "en-CA", {
    day: "numeric",
    month: "short",
  });
}

// ─── Card ────────────────────────────────────────────────────────────────────

function NotificationCard({
  notification,
  onTap,
  locale,
  t,
}: {
  notification: Notification;
  onTap: (n: Notification) => void;
  locale: string;
  t: (k: TranslationKey) => string;
}) {
  const style = TYPE_STYLES[notification.type] ?? {
    icon: Bell, tint: "bg-slate-50", fg: "text-slate-500", ring: "ring-slate-100",
    category: "notif_cat_social" as TranslationKey,
  };
  const Icon = style.icon;
  const unread = !notification.is_read;

  return (
    <button
      onClick={() => onTap(notification)}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl bg-white text-left transition-all duration-200",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]",
        "hover:shadow-[0_6px_20px_-4px_rgba(15,23,42,0.08),0_0_0_1px_rgba(15,23,42,0.06)] hover:-translate-y-[1px]",
        "active:translate-y-0 active:shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]"
      )}
    >
      {/* Unread left accent bar */}
      {unread && (
        <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[rgb(246,51,154)]" />
      )}

      <div className="flex items-start gap-3 p-4">
        {/* Avatar with icon badge overlay */}
        <div className="relative flex-shrink-0">
          <div className="h-11 w-11 overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-100">
            {notification.actor_avatar ? (
              <Image
                src={notification.actor_avatar}
                alt=""
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className={cn("flex h-full w-full items-center justify-center", style.tint)}>
                <Icon size={18} className={style.fg} />
              </div>
            )}
          </div>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-white",
              style.tint
            )}
          >
            <Icon size={11} strokeWidth={2.4} className={style.fg} />
          </div>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {t(style.category)}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-400">
                {relTime(notification.created_at, locale)}
              </span>
              {unread && (
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(246,51,154)]" />
              )}
            </div>
          </div>

          <p className={cn(
            "mt-1 text-[14px] leading-snug",
            unread ? "font-semibold text-slate-900" : "font-medium text-slate-800"
          )}>
            {notification.actor_username && (
              <span className="font-bold">{notification.actor_username}</span>
            )}
            {notification.actor_username && notification.body && <span> · </span>}
            <span className={unread ? "text-slate-700 font-medium" : "text-slate-500"}>
              {notification.body || notification.title}
            </span>
          </p>

          {style.action && (
            <div className="mt-2.5 flex items-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold text-white">
                {t(style.action)}
                <ChevronRight size={12} strokeWidth={2.5} />
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function NotificationSkeleton() {
  return (
    <div className="space-y-2.5 px-3 pt-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_0_0_1px_rgba(15,23,42,0.04)]"
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 flex-shrink-0 rounded-full bg-gray-100 shimmer" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-2.5 w-24 rounded-full bg-gray-100 shimmer" />
                <div className="h-2.5 w-8 rounded-full bg-gray-50 shimmer" />
              </div>
              <div className="h-3.5 w-4/5 rounded-full bg-gray-100 shimmer" />
              <div className="h-3 w-3/5 rounded-full bg-gray-50 shimmer" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state illustration (CSS mailbox) ──────────────────────────────────

function EmptyMailbox() {
  return (
    <div className="relative mx-auto mb-5 h-40 w-40">
      {/* Soft radial backdrop */}
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_45%,rgba(246,51,154,0.12),transparent_65%)]" />

      {/* Floating decorations */}
      <svg
        viewBox="0 0 160 160"
        className="absolute inset-0 h-full w-full"
        fill="none"
        aria-hidden
      >
        {/* Bubbles */}
        <circle cx="28" cy="40" r="3" fill="rgb(246,51,154)" fillOpacity="0.25" />
        <circle cx="38" cy="24" r="2" fill="rgb(246,51,154)" fillOpacity="0.35" />
        <circle cx="132" cy="36" r="2.5" fill="rgb(14,165,233)" fillOpacity="0.3" />
        <circle cx="120" cy="18" r="1.8" fill="rgb(14,165,233)" fillOpacity="0.45" />
        <circle cx="22" cy="92" r="2" fill="rgb(246,51,154)" fillOpacity="0.35" />

        {/* Leaves (soft sky + pink tips) */}
        <path
          d="M128 70 Q146 64 148 52 Q136 50 128 66 Z"
          fill="rgb(125,211,252)"
          fillOpacity="0.5"
        />
        <path
          d="M138 86 Q152 82 152 72 Q142 72 136 84 Z"
          fill="rgb(251,207,232)"
        />
        <path
          d="M24 60 Q12 54 12 42 Q24 42 30 56 Z"
          fill="rgb(251,207,232)"
        />
      </svg>

      {/* Mailbox */}
      <div className="absolute inset-0 flex items-end justify-center pb-4">
        <div className="relative flex flex-col items-center">
          {/* Flag arm + flag */}
          <div className="absolute -right-3 top-4 z-20">
            <div className="h-10 w-[2px] bg-pink-900/50" />
            <div className="absolute left-0 top-0 h-3.5 w-5 rounded-[2px] bg-gradient-to-r from-pink-400 to-pink-500 shadow-sm" />
          </div>

          {/* Box body */}
          <div className="relative z-10 h-16 w-24 overflow-hidden rounded-t-[28px] bg-gradient-to-b from-pink-400 via-[rgb(246,51,154)] to-pink-600 shadow-[0_10px_24px_-6px_rgba(246,51,154,0.5)]">
            {/* Highlight */}
            <div className="absolute inset-x-0 top-0 h-5 rounded-t-[28px] bg-gradient-to-b from-white/30 to-transparent" />
            {/* Slot */}
            <div className="mx-auto mt-5 h-1.5 w-12 rounded-full bg-pink-950/40" />
            {/* Little dot label */}
            <div className="mx-auto mt-1.5 h-1 w-1 rounded-full bg-white/60" />
          </div>

          {/* Envelope sticking out */}
          <div className="absolute -top-2 left-1/2 z-20 flex h-8 w-14 -translate-x-1/2 items-center justify-center rounded-[4px] bg-white shadow-[0_4px_10px_rgba(15,23,42,0.15)] ring-1 ring-pink-100">
            <Mail size={14} className="text-[rgb(246,51,154)]" strokeWidth={2.2} />
          </div>

          {/* Post */}
          <div className="relative z-0 h-10 w-2.5 rounded-b-sm bg-gradient-to-b from-pink-900/70 to-pink-950/80" />
          {/* Ground shadow */}
          <div className="h-1.5 w-16 rounded-full bg-slate-900/10 blur-sm" />
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { profile, loading: profileLoading } = useProfile();
  const { notifications: rawNotifications, loading, hasMore, markAsRead, markAllAsRead, loadMore } =
    useNotifications();
  const [tab, setTab] = useState<TabKey>("all");

  const notifications = useMemo(
    () => (USE_BOOKINGS ? rawNotifications : rawNotifications.filter((n) => !BOOKING_TYPES.includes(n.type))),
    [rawNotifications]
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered = useMemo(() => {
    switch (tab) {
      case "unread":   return notifications.filter((n) => !n.is_read);
      case "social":   return notifications.filter((n) => SOCIAL_TYPES.includes(n.type));
      case "messages": return notifications.filter((n) => MESSAGE_TYPES.includes(n.type));
      case "bookings": return notifications.filter((n) => BOOKING_TYPES.includes(n.type));
      default:         return notifications;
    }
  }, [notifications, tab]);

  const grouped = useMemo(() => {
    const map: Record<GroupKey, Notification[]> = { today: [], yesterday: [], this_week: [], earlier: [] };
    for (const n of filtered) map[groupOf(n.created_at)].push(n);
    return map;
  }, [filtered]);

  const handleTap = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    router.push(getNotificationRoute(n));
  };

  if (profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-500" />
      </div>
    );
  }

  if (!profile) {
    router.push("/auth/signin");
    return null;
  }

  const tabs: { key: TabKey; label: TranslationKey; count?: number }[] = [
    { key: "all",      label: "notif_tab_all" },
    { key: "unread",   label: "notif_tab_unread",   count: unreadCount },
    { key: "social",   label: "notif_tab_social" },
    { key: "messages", label: "notif_tab_messages" },
    ...(USE_BOOKINGS ? [{ key: "bookings" as TabKey, label: "notif_tab_bookings" as TranslationKey }] : []),
  ];

  const subtitle = unreadCount === 0
    ? t("notif_subtitle_all_caught_up")
    : (unreadCount === 1 ? t("notif_subtitle_unread") : t("notif_subtitle_unread_plural")).replace("{n}", String(unreadCount));

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      {/* ── Header ── */}
      <header className="bg-[rgb(246,51,154)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-3">
          <button
            onClick={() => router.back()}
            className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-white/95 transition-colors hover:bg-white/10 active:bg-white/15"
            aria-label="Back"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-bold uppercase leading-none tracking-wide text-white">
                {t("notif_page_title")}
              </h1>
              {unreadCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-white px-1.5 text-[10.5px] font-bold leading-none text-[rgb(246,51,154)]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-[11.5px] font-medium text-white/80">
              {subtitle}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20 active:bg-white/25"
            >
              <CheckCheck size={13} />
              {t("notif_mark_all_read")}
            </button>
          )}
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-[#fafbfc]/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          <div className="flex gap-2 overflow-x-auto px-3 py-3 scrollbar-hide">
            {tabs.map((tb) => {
              const active = tab === tb.key;
              return (
                <button
                  key={tb.key}
                  onClick={() => setTab(tb.key)}
                  className={cn(
                    "relative flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all",
                    active
                      ? "bg-slate-900 text-white shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
                      : "bg-white text-slate-500 ring-1 ring-gray-200 hover:text-slate-700"
                  )}
                >
                  {t(tb.label)}
                  {typeof tb.count === "number" && tb.count > 0 && (
                    <span
                      className={cn(
                        "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        active ? "bg-[rgb(246,51,154)] text-white" : "bg-[rgb(246,51,154)] text-white"
                      )}
                    >
                      {tb.count > 99 ? "99+" : tb.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-lg">
        {loading && notifications.length === 0 ? (
          <NotificationSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 pt-10 pb-16 text-center">
            <EmptyMailbox />
            <h3 className="text-[18px] font-bold text-slate-800">
              {tab === "all" ? t("notif_empty") : t("notif_empty_filter")}
            </h3>
            <p className="mt-2 max-w-xs text-[13px] leading-snug text-slate-500">
              {tab === "all" ? t("notif_empty_body") : t("notif_empty_filter_body")}
            </p>
            <Link
              href={USE_BOOKINGS ? "/profile/bookings" : "/explore"}
              className="mt-6 inline-flex items-center justify-center rounded-full bg-[rgb(246,51,154)] px-6 py-2.5 text-[12.5px] font-bold uppercase tracking-wider text-white shadow-[0_8px_20px_-6px_rgba(246,51,154,0.6)] transition-transform hover:brightness-105 active:scale-95"
            >
              {USE_BOOKINGS ? t("notif_empty_cta_bookings") : t("notif_empty_cta_explore")}
            </Link>
          </div>
        ) : (
          <div className="pb-4">
            {GROUP_ORDER.map((gk) => {
              const rows = grouped[gk];
              if (rows.length === 0) return null;
              return (
                <section key={gk} className="pt-3">
                  <div className="sticky top-[52px] z-10 bg-[#fafbfc]/95 px-4 py-1.5 backdrop-blur-sm">
                    <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {t(GROUP_LABELS[gk])}
                    </span>
                  </div>
                  <div className="space-y-2 px-3 pt-1">
                    {rows.map((n) => (
                      <NotificationCard
                        key={n.id}
                        notification={n}
                        onTap={handleTap}
                        locale={locale}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {hasMore && tab === "all" && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="mx-auto mt-4 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-pink-200 hover:text-pink-500 disabled:opacity-50"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : t("notif_load_more")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
