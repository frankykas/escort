"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Compass, LayoutGrid, MessageCircle, User,
  LayoutDashboard, CalendarCheck, ListOrdered, ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/messages/"];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  label: string;
  icon: React.ElementType;
  href: string;
  active: boolean;
};

function useClientTabs(pathname: string, t: (k: TranslationKey) => string): TabDef[] {
  return [
    { label: t("nav_home"),     icon: Home,        href: "/",        active: pathname === "/" },
    { label: t("nav_explore"),  icon: Compass,     href: "/explore", active: pathname.startsWith("/explore") },
    { label: t("nav_listings"), icon: LayoutGrid,  href: "/listings",active: pathname.startsWith("/listings") },
    { label: t("nav_messages"), icon: MessageCircle, href: "/messages", active: pathname.startsWith("/messages") },
    { label: t("nav_profile"),  icon: User,        href: "/profile", active: pathname.startsWith("/profile") },
  ];
}

function useProviderTabs(pathname: string, t: (k: TranslationKey) => string): TabDef[] {
  return [
    { label: t("nav_dashboard"), icon: LayoutDashboard, href: "/",                 active: pathname === "/" },
    { label: t("nav_bookings"),  icon: CalendarCheck,   href: "/profile/bookings", active: pathname === "/profile/bookings" },
    { label: t("nav_messages"),  icon: MessageCircle,   href: "/messages",         active: pathname.startsWith("/messages") },
    { label: t("nav_listings"),  icon: ListOrdered,     href: "/profile/listings", active: pathname === "/profile/listings" || pathname === "/profile/upload" },
    { label: t("nav_profile"),   icon: User,            href: "/profile",          active: pathname.startsWith("/profile") && pathname !== "/profile/bookings" && pathname !== "/profile/listings" && pathname !== "/profile/upload" },
  ];
}

// ─── Inner nav (needs useSearchParams → must be inside Suspense) ──────────────

function BottomNavInner() {
  const pathname = usePathname();
  const { profile, isProvider, loading } = useProfile();
  const { t } = useTranslation();

  const clientTabs = useClientTabs(pathname, t);
  const providerTabs = useProviderTabs(pathname, t);

  // Hide on auth and full-screen message threads
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const tabs = isProvider ? providerTabs : clientTabs;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-label={t.label}
              className={cn(
                "flex flex-col items-center gap-[3px] py-3 px-4 transition-all duration-150",
                t.active ? "text-white" : "text-zinc-600",
                // Dim while role is still loading to avoid wrong-tab flash
                loading && "opacity-0 pointer-events-none"
              )}
            >
              <Icon
                size={24}
                strokeWidth={t.active ? 2.5 : 1.8}
                className={cn(
                  "transition-all duration-150",
                  t.active && "drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                )}
              />
              <span
                className={cn(
                  "text-[9px] font-medium tracking-wide uppercase transition-colors",
                  t.active ? "text-amber-400" : "text-zinc-600"
                )}
              >
                {t.label}
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
