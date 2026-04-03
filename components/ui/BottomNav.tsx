"use client";

import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Compass, User, Bell,
  LayoutDashboard, PlusCircle, MessageSquare,
  Camera, Image as ImageIcon, ListOrdered, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadCount";
import type { TranslationKey } from "@/lib/i18n/en";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/onboarding"];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  label: string;
  icon: React.ElementType;
  href: string;
  active: boolean;
  badge?: number;
  isCreate?: boolean;
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
    { label: t("nav_create"),        icon: PlusCircle,      href: "/profile/upload",   active: pathname === "/profile/upload", isCreate: true },
    { label: t("nav_messages"),      icon: MessageSquare,   href: "/messages",         active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_alerts"),        icon: Bell,            href: "/notifications",    active: pathname.startsWith("/notifications"), badge: unreadNotifs },
    { label: t("nav_profile"),       icon: User,            href: "/profile",          active: pathname.startsWith("/profile") && pathname !== "/profile/upload" },
  ];
}

// ─── Create menu items ───────────────────────────────────────────────────────

type CreateItem = {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  action: () => void;
};

// ─── Inner nav ──────────────────────────────────────────────────────────────

function BottomNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const { isProvider, loading, profile } = useProfile();
  const { t } = useTranslation();
  const { count: unreadNotifs } = useUnreadCount();
  const unreadMsgs = useUnreadMessages();
  const [createOpen, setCreateOpen] = useState(false);

  const clientTabs = useClientTabs(pathname, t, unreadNotifs, unreadMsgs);
  const providerTabs = useProviderTabs(pathname, t, unreadNotifs, unreadMsgs, profile?.username ?? "");

  const handleCreate = useCallback((type: "story" | "post" | "listing") => {
    setCreateOpen(false);
    if (type === "listing") {
      router.push("/profile/listings?new=1");
      return;
    }
    // Set draft type so upload page opens on the right tab
    localStorage.setItem("upload_draft_type", type);
    router.push("/profile/upload");
  }, [router]);

  // Hide on auth and full-screen message threads
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const tabs = isProvider ? providerTabs : clientTabs;

  const createItems: CreateItem[] = [
    {
      label: "Story",
      description: "Disappears after 24h",
      icon: Camera,
      color: "text-orange-400",
      bg: "bg-orange-500/15",
      action: () => handleCreate("story"),
    },
    {
      label: "Post",
      description: "Share to your feed",
      icon: ImageIcon,
      color: "text-pink-400",
      bg: "bg-pink-500/15",
      action: () => handleCreate("post"),
    },
    {
      label: "Listing",
      description: "Add a service",
      icon: ListOrdered,
      color: "text-amber-400",
      bg: "bg-amber-500/15",
      action: () => handleCreate("listing"),
    },
  ];

  return (
    <>
      {/* Create menu overlay */}
      <AnimatePresence>
        {createOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
              onClick={() => setCreateOpen(false)}
            />

            {/* Menu items — radial fan from the create button position */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-0 bottom-0 z-50"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 70px)" }}
            >
              <div className="mx-auto max-w-sm px-6 space-y-2">
                {createItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 20, scale: 0.95 }}
                      transition={{
                        duration: 0.25,
                        delay: (createItems.length - 1 - i) * 0.05,
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                      onClick={item.action}
                      className="flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/95 px-5 py-4 text-left backdrop-blur-xl transition-all active:scale-[0.98] hover:border-white/20"
                    >
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", item.bg)}>
                        <Icon size={20} className={item.color} />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-white">{item.label}</p>
                        <p className="text-[12px] text-zinc-500">{item.description}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Close button overlaying the + tab */}
            <motion.button
              initial={{ rotate: 0 }}
              animate={{ rotate: 45 }}
              exit={{ rotate: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setCreateOpen(false)}
              className="fixed bottom-0 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-[3px] py-3 px-4 text-amber-400"
              style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              <PlusCircle size={24} strokeWidth={2.5} className="drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]" />
              <span className="text-[9px] font-medium tracking-wide uppercase text-amber-400">
                {t("nav_create")}
              </span>
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* Nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;

            // Create button — open menu instead of navigating
            if (tab.isCreate) {
              return (
                <button
                  key={tab.label}
                  onClick={() => setCreateOpen(true)}
                  aria-label={tab.label}
                  className={cn(
                    "relative flex flex-col items-center gap-[3px] py-3 px-4 transition-all duration-150",
                    createOpen ? "text-amber-400" : tab.active ? "text-white" : "text-zinc-600",
                    loading && "opacity-0 pointer-events-none"
                  )}
                >
                  <div className="relative">
                    <Icon
                      size={24}
                      strokeWidth={tab.active || createOpen ? 2.5 : 1.8}
                      className={cn(
                        "transition-all duration-150",
                        (tab.active || createOpen) && "drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-medium tracking-wide uppercase transition-colors",
                      createOpen || tab.active ? "text-amber-400" : "text-zinc-600"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

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
    </>
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
