"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, User, Bell,
  LayoutDashboard, PlusCircle, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useStreamUnread } from "@/hooks/useStreamUnread";
import type { TranslationKey } from "@/lib/i18n/en";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/onboarding"];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  label: string;
  icon: React.ElementType;
  href: string;
  active: boolean;
  badge?: number;
};

function useClientTabs(
  pathname: string,
  t: (k: TranslationKey) => string,
  unreadNotifs: number,
  unreadMsgs: number,
): TabDef[] {
  return [
    { label: t("nav_home"),     icon: Home,          href: "/",              active: pathname === "/" },
    { label: t("nav_explore"),  icon: Compass,       href: "/explore",       active: pathname.startsWith("/explore") },
    { label: t("nav_messages"), icon: MessageSquare,  href: "/messages",      active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_alerts"),   icon: Bell,           href: "/notifications", active: pathname.startsWith("/notifications"), badge: unreadNotifs },
    { label: t("nav_profile"),  icon: User,           href: "/profile",       active: pathname.startsWith("/profile") },
  ];
}

function useProviderTabs(
  pathname: string,
  t: (k: TranslationKey) => string,
  unreadNotifs: number,
  unreadMsgs: number,
  username: string,
): TabDef[] {
  return [
    { label: "My Page",              icon: LayoutDashboard, href: `/u/${username}`,     active: pathname === `/u/${username}` },
    { label: t("nav_create"),        icon: PlusCircle,      href: "/profile/upload",   active: pathname === "/profile/upload" },
    { label: t("nav_messages"),      icon: MessageSquare,   href: "/messages",         active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_alerts"),        icon: Bell,            href: "/notifications",    active: pathname.startsWith("/notifications"), badge: unreadNotifs },
    { label: t("nav_profile"),       icon: User,            href: "/profile",          active: pathname.startsWith("/profile") && pathname !== "/profile/upload" },
  ];
}

// ─── Inner nav (needs useSearchParams → must be inside Suspense) ──────────────

function BottomNavInner() {
  const pathname = usePathname();
  const { isProvider, loading, profile } = useProfile();
  const { t } = useTranslation();
  const { count: unreadNotifs } = useUnreadCount();
  const unreadMsgs = useStreamUnread();

  const clientTabs = useClientTabs(pathname, t, unreadNotifs, unreadMsgs);
  const providerTabs = useProviderTabs(pathname, t, unreadNotifs, unreadMsgs, profile?.username ?? "");

  // Hide on auth and full-screen message threads
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const tabs = isProvider ? providerTabs : clientTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.badge ? `${tab.label} (${tab.badge} new)` : tab.label}
              className={cn(
                "relative flex flex-col items-center gap-[3px] py-3 px-4 transition-all duration-150",
                tab.active ? "text-white" : "text-zinc-600",
                loading && "opacity-0 pointer-events-none"
              )}
            >
              <div className="relative">
                <Icon
                  size={24}
                  strokeWidth={tab.active ? 2.5 : 1.8}
                  className={cn(
                    "transition-all duration-150",
                    tab.active && "drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                  )}
                />
                {tab.badge != null && tab.badge > 0 && (
                  <span
                    className={cn(
                      "absolute -top-1.5 -right-2.5 flex items-center justify-center",
                      "min-w-[16px] h-[16px] px-[4px] rounded-full",
                      "bg-red-500 text-white text-[9px] font-bold leading-none",
                      "ring-2 ring-black"
                    )}
                  >
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium tracking-wide uppercase transition-colors",
                  tab.active ? "text-amber-400" : "text-zinc-600"
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
