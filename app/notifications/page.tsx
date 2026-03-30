"use client";

import { useRouter } from "next/navigation";
import {
  Bell, BellOff, CalendarCheck, CheckCheck, Heart, MessageCircle,
  Star, UserPlus, ArrowLeft, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useNotifications } from "@/hooks/useNotifications";
import { getNotificationRoute } from "@/lib/notifications";
import type { Notification, NotificationType } from "@/lib/notifications";

// ─── Icon + color per notification type ──────────────────────────────────────

const TYPE_CONFIG: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  booking_requested: { icon: CalendarCheck, color: "text-blue-400" },
  booking_accepted:  { icon: CalendarCheck, color: "text-green-400" },
  booking_declined:  { icon: CalendarCheck, color: "text-red-400" },
  booking_completed: { icon: CalendarCheck, color: "text-amber-400" },
  booking_cancelled: { icon: CalendarCheck, color: "text-zinc-400" },
  review_received:   { icon: Star,          color: "text-yellow-400" },
  new_follower:      { icon: UserPlus,      color: "text-purple-400" },
  new_subscriber:    { icon: UserPlus,      color: "text-amber-400" },
  post_liked:        { icon: Heart,         color: "text-pink-400" },
  post_commented:    { icon: MessageCircle, color: "text-blue-400" },
  new_message:       { icon: MessageCircle, color: "text-green-400" },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ─── Single notification row ─────────────────────────────────────────────────

function NotificationRow({
  notification,
  onTap,
}: {
  notification: Notification;
  onTap: (n: Notification) => void;
}) {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <button
      onClick={() => onTap(notification)}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-zinc-800/50 active:bg-zinc-800",
        !notification.is_read && "bg-zinc-900/80"
      )}
    >
      {/* Avatar or icon */}
      <div className="relative flex-shrink-0">
        {notification.actor_avatar ? (
          <img
            src={notification.actor_avatar}
            alt=""
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
            <Icon size={18} className={config.color} />
          </div>
        )}
        {/* Type badge overlay */}
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full",
            "bg-zinc-950 flex items-center justify-center ring-1 ring-zinc-800"
          )}
        >
          <Icon size={10} className={config.color} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm leading-snug", !notification.is_read ? "text-white" : "text-zinc-400")}>
          <span className="font-semibold">{notification.title}</span>
          {notification.body && (
            <span className="text-zinc-400 ml-1">{notification.body}</span>
          )}
        </p>
        <p className="text-xs text-zinc-600 mt-0.5">{timeAgo(notification.created_at)}</p>
      </div>

      {/* Unread dot */}
      {!notification.is_read && (
        <div className="flex-shrink-0 mt-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
        </div>
      )}
    </button>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const { notifications, loading, hasMore, markAsRead, markAllAsRead, loadMore } =
    useNotifications();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleTap = (n: Notification) => {
    if (!n.is_read) markAsRead(n.id);
    const route = getNotificationRoute(n);
    router.push(route);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!profile) {
    router.push("/auth/signin");
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/60">
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-zinc-400 hover:text-white">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold text-white">Notifications</h1>
            {unreadCount > 0 && (
              <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
        </div>
      </header>

      {/* Notification list */}
      <div className="max-w-lg mx-auto divide-y divide-zinc-800/50">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
              <BellOff size={28} className="text-zinc-600" />
            </div>
            <p className="text-zinc-400 font-medium">No notifications yet</p>
            <p className="text-zinc-600 text-sm mt-1">
              Booking updates, messages, and activity will appear here.
            </p>
          </div>
        ) : (
          <>
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onTap={handleTap} />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loading}
                className="w-full py-4 text-sm text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin mx-auto" />
                ) : (
                  "Load more"
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
