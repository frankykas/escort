"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadCount } from "@/hooks/useNotifications";

export function NotificationBell() {
  const { count } = useUnreadCount();

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
      className="relative p-2"
    >
      <Bell size={22} strokeWidth={1.8} className="text-zinc-400 hover:text-white transition-colors" />
      {count > 0 && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex items-center justify-center",
            "min-w-[18px] h-[18px] px-1 rounded-full",
            "bg-red-500 text-white text-[10px] font-bold",
            "ring-2 ring-zinc-950",
            "animate-in fade-in zoom-in-50 duration-200"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
