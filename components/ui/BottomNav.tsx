"use client";

import { Suspense, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home, Compass, User, Bell,
  LayoutDashboard, Plus, MessageSquare,
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
    { label: t("nav_my_page"),        icon: LayoutDashboard, href: `/u/${username}`,     active: pathname === `/u/${username}` },
    { label: t("nav_messages"),      icon: MessageSquare,   href: "/messages",         active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_create"),        icon: Plus,            href: "/profile/upload",   active: pathname === "/profile/upload", isCreate: true },
    { label: t("nav_explore"),       icon: Compass,         href: "/explore",          active: pathname.startsWith("/explore") },
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

// ─── Standard tab button ─────────────────────────────────────────────────────

function NavTab({ tab, loading }: { tab: TabDef; loading: boolean }) {
  const Icon = tab.icon;
  const hasBadge = tab.badge != null && tab.badge > 0;

  // Derive a tour anchor id from the tab href so the SpotlightTour can target it
  const tourId = `nav-${tab.href.replace(/^\//, "").replace(/\/.*$/, "") || "home"}`;

  return (
    <Link
      href={tab.href}
      aria-label={hasBadge ? `${tab.label} (${tab.badge} new)` : tab.label}
      data-tour={tourId}
      className={cn(
        "group relative flex flex-1 flex-col items-center py-3 transition-all duration-200",
        loading && "opacity-0 pointer-events-none"
      )}
    >
      {/* Active indicator — thin gold bar at top of nav */}
      {tab.active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute -top-px left-1/2 h-[2px] w-8 -translate-x-1/2 rounded-full bg-[#FCBA03]"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}

      <div className="relative">
        <Icon
          size={22}
          strokeWidth={tab.active ? 2.4 : 1.6}
          className={cn(
            "transition-all duration-200",
            tab.active
              ? "text-white"
              : "text-zinc-600 group-hover:text-zinc-400"
          )}
        />

        {/* Badge */}
        {hasBadge && (
          <span className="absolute -top-1 -right-2 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#FCBA03] px-[3px] text-[8px] font-bold leading-none text-[#0a0a0a] ring-2 ring-[#111]">
            {tab.badge! > 99 ? "99+" : tab.badge}
          </span>
        )}
      </div>

      <span
        className={cn(
          "mt-1 text-[9px] font-medium tracking-wide transition-colors duration-200",
          tab.active
            ? "text-[#FCBA03]"
            : "text-zinc-600 group-hover:text-zinc-400"
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}

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
    localStorage.setItem("upload_draft_type", type);
    router.push("/profile/upload");
  }, [router]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  const tabs = isProvider ? providerTabs : clientTabs;
  const hasFloatingCreate = isProvider;

  const createItems: CreateItem[] = [
    {
      label: t("create_story"),
      description: t("create_story_desc"),
      icon: Camera,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
      action: () => handleCreate("story"),
    },
    {
      label: t("create_post"),
      description: t("create_post_desc"),
      icon: ImageIcon,
      color: "text-pink-400",
      bg: "bg-pink-400/10",
      action: () => handleCreate("post"),
    },
    {
      label: t("create_listing"),
      description: t("create_listing_desc"),
      icon: ListOrdered,
      color: "text-[#FCBA03]",
      bg: "bg-[#FCBA03]/10",
      action: () => handleCreate("listing"),
    },
  ];

  return (
    <>
      {/* ── Create menu overlay ── */}
      <AnimatePresence>
        {createOpen && (
          <>
            {/* Backdrop — dark with subtle noise */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md"
              onClick={() => setCreateOpen(false)}
            />

            {/* Menu cards */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-0 bottom-0 z-50"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)" }}
            >
              <div className="mx-auto max-w-sm space-y-2 px-5">
                {createItems.map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, y: 24, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 16, scale: 0.96 }}
                      transition={{
                        duration: 0.3,
                        delay: (createItems.length - 1 - i) * 0.05,
                        type: "spring",
                        stiffness: 380,
                        damping: 26,
                      }}
                      onClick={item.action}
                      className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#161616]/95 px-5 py-4 text-left backdrop-blur-xl transition-all active:scale-[0.98] hover:bg-[#1c1c1c] glow-card"
                    >
                      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", item.bg)}>
                        <Icon size={20} className={item.color} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[14px] font-semibold text-zinc-100">{item.label}</p>
                        <p className="text-[12px] text-zinc-600">{item.description}</p>
                      </div>
                      <ChevronIcon className="text-zinc-700" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Close button — appears where the floating + was */}
            <motion.button
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 28 }}
              onClick={() => setCreateOpen(false)}
              className="fixed z-50 left-1/2 -translate-x-1/2 flex h-[56px] w-[56px] items-center justify-center rounded-full bg-gradient-to-br from-[#FCBA03] via-[#f5a623] to-[#e8930c] shadow-[0_4px_28px_rgba(252,186,3,0.4)] ring-[4px] ring-[#0e0e0e]"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
            >
              <X size={22} strokeWidth={2.5} className="text-[#0a0a0a]" />
            </motion.button>
          </>
        )}
      </AnimatePresence>

      {/* ── Nav bar ── */}
      <nav className="fixed bottom-0 inset-x-0 z-40">
        {/* Top edge highlight */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        <div className="bg-[#111]/80 backdrop-blur-2xl backdrop-saturate-[1.8]">
          <div className="relative mx-auto flex max-w-lg items-stretch pb-[env(safe-area-inset-bottom,0px)]">
            {tabs.map((tab) => {
              // ── Floating center Create button ──
              if (tab.isCreate) {
                return (
                  <div
                    key={tab.label}
                    className="relative flex flex-1 flex-col items-center justify-end py-3"
                  >
                    {/* Floating button — hide when create menu is open to avoid overlap */}
                    <AnimatePresence>
                      {!createOpen && (
                        <motion.button
                          onClick={() => setCreateOpen(true)}
                          aria-label={tab.label}
                          data-tour="nav-create"
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 28 }}
                          whileTap={{ scale: 0.92 }}
                          className={cn(
                            "absolute -top-6 flex h-[56px] w-[56px] items-center justify-center rounded-full",
                            "bg-gradient-to-br from-[#FCBA03] via-[#f5a623] to-[#e8930c]",
                            "shadow-[0_4px_20px_rgba(252,186,3,0.3)]",
                            "ring-[4px] ring-[#111]",
                            "transition-shadow duration-300 hover:shadow-[0_4px_28px_rgba(252,186,3,0.45)]",
                            loading && "opacity-0 pointer-events-none"
                          )}
                        >
                          <Plus
                            size={26}
                            strokeWidth={2.5}
                            className="text-[#0a0a0a]"
                          />
                        </motion.button>
                      )}
                    </AnimatePresence>

                    {/* Label */}
                    <span
                      className={cn(
                        "text-[9px] font-medium tracking-wide text-zinc-600",
                        loading && "opacity-0"
                      )}
                    >
                      {tab.label}
                    </span>
                  </div>
                );
              }

              // ── Standard tab ──
              return <NavTab key={tab.label} tab={tab} loading={loading} />;
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

// ─── Tiny chevron for create menu items ──────────────────────────────────────

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
