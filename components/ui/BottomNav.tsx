"use client";

import { Suspense, useCallback, useState, type ElementType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  Compass,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  Plus,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/contexts/ProfileContext";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadCount";
import type { TranslationKey } from "@/lib/i18n/en";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/onboarding"];
const ACTIVE_PINK = "#ff2d8d";

type TabDef = {
  label: string;
  icon: ElementType;
  href: string;
  active: boolean;
  badge?: number;
  isCreate?: boolean;
};

type CreateItem = {
  label: string;
  description: string;
  icon: ElementType;
  color: string;
  bg: string;
  action: () => void;
};

function useClientTabs(
  pathname: string,
  t: (k: TranslationKey) => string,
  unreadNotifs: number,
  unreadMsgs: number,
): TabDef[] {
  return [
    { label: t("nav_home"), icon: Home, href: "/", active: pathname === "/" },
    { label: t("nav_explore"), icon: Compass, href: "/explore", active: pathname.startsWith("/explore") },
    { label: t("nav_messages"), icon: MessageSquare, href: "/messages", active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_alerts"), icon: Bell, href: "/notifications", active: pathname.startsWith("/notifications"), badge: unreadNotifs },
    { label: t("nav_profile"), icon: User, href: "/profile", active: pathname.startsWith("/profile") },
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
    { label: t("nav_my_page"), icon: LayoutDashboard, href: `/u/${username}`, active: pathname === `/u/${username}` },
    { label: t("nav_messages"), icon: MessageSquare, href: "/messages", active: pathname === "/messages", badge: unreadMsgs },
    { label: t("nav_create"), icon: Plus, href: "/profile/upload", active: pathname === "/profile/upload", isCreate: true },
    { label: t("nav_alerts"), icon: Bell, href: "/notifications", active: pathname.startsWith("/notifications"), badge: unreadNotifs },
    { label: t("nav_profile"), icon: User, href: "/profile", active: pathname.startsWith("/profile") && pathname !== "/profile/upload" },
  ];
}

function NavItemContent({
  tab,
  loading,
  activeOverride = false,
}: {
  tab: TabDef;
  loading: boolean;
  activeOverride?: boolean;
}) {
  const Icon = tab.icon;
  const active = tab.active || activeOverride;
  const hasBadge = tab.badge != null && tab.badge > 0;

  return (
    <span
      className={cn(
        "group relative flex h-[58px] flex-1 flex-col items-center justify-center gap-1 transition duration-200",
        loading && "pointer-events-none opacity-0",
      )}
    >
      <span className="relative flex h-6 items-center justify-center">
        <Icon
          size={21}
          strokeWidth={active ? 1.95 : 1.65}
          className={cn(
            "transition-colors duration-200",
            active ? "text-[#ff2d8d]" : "text-[#4b5563] group-hover:text-[#111827]",
          )}
        />
        {hasBadge && (
          <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-[#ff2d8d] ring-2 ring-white/85" />
        )}
      </span>

      <span
        className={cn(
          "text-[10px] font-semibold leading-none tracking-normal transition-colors duration-200",
          active ? "text-[#ff2d8d]" : "text-[#5f6673] group-hover:text-[#111827]",
        )}
      >
        {tab.label}
      </span>
    </span>
  );
}

function NavTab({ tab, loading }: { tab: TabDef; loading: boolean }) {
  const hasBadge = tab.badge != null && tab.badge > 0;
  const tourId = `nav-${tab.href.replace(/^\//, "").replace(/\/.*$/, "") || "home"}`;

  return (
    <Link
      href={tab.href}
      aria-label={hasBadge ? `${tab.label} (${tab.badge} new)` : tab.label}
      data-tour={tourId}
      className="flex flex-1"
    >
      <NavItemContent tab={tab} loading={loading} />
    </Link>
  );
}

function BottomNavInner() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();
  const { isProvider, loading, profile } = useProfile();
  const { t } = useTranslation();
  const { count: unreadNotifs } = useUnreadCount();
  const unreadMsgs = useUnreadMessages();
  const [createOpen, setCreateOpen] = useState(false);

  const clientTabs = useClientTabs(pathname, t, unreadNotifs, unreadMsgs);
  const providerTabs = useProviderTabs(pathname, t, unreadNotifs, unreadMsgs, profile?.username ?? "");
  const tabs = isProvider ? providerTabs : clientTabs;

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
  if (pathname === "/" && !sessionLoading && !user) return null;

  const createItems: CreateItem[] = [
    {
      label: t("create_story"),
      description: t("create_story_desc"),
      icon: Camera,
      color: "text-sky-500",
      bg: "bg-sky-50",
      action: () => handleCreate("story"),
    },
    {
      label: t("create_post"),
      description: t("create_post_desc"),
      icon: ImageIcon,
      color: "text-pink-500",
      bg: "bg-pink-50",
      action: () => handleCreate("post"),
    },
    {
      label: t("create_listing"),
      description: t("create_listing_desc"),
      icon: ListOrdered,
      color: "text-violet-500",
      bg: "bg-violet-50",
      action: () => handleCreate("listing"),
    },
  ];

  return (
    <>
      <AnimatePresence>
        {createOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm"
              onClick={() => setCreateOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-x-0 bottom-0 z-50"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)" }}
            >
              <div className="mx-auto max-w-sm space-y-2 px-5">
                {createItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className="flex w-full items-center gap-4 rounded-[24px] border border-white/70 bg-white/88 px-5 py-4 text-left shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl transition active:scale-[0.98]"
                    >
                      <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", item.bg)}>
                        <Icon size={20} strokeWidth={1.8} className={item.color} />
                      </span>
                      <span className="flex-1">
                        <span className="block text-[14px] font-semibold text-slate-800">{item.label}</span>
                        <span className="block text-[12px] text-slate-400">{item.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              aria-label="Close create menu"
              className="fixed left-1/2 z-50 flex h-[52px] w-[52px] -translate-x-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-[#ff2d8d] shadow-[0_18px_38px_-26px_rgba(15,23,42,0.45)] backdrop-blur-xl"
              style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
            >
              <X size={21} strokeWidth={1.9} />
            </button>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
        <div className="mx-auto max-w-[430px] rounded-full border border-white bg-[#fff1f7] shadow-[0_18px_42px_-22px_rgba(15,23,42,0.38),0_8px_22px_-18px_rgba(15,23,42,0.32),inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="relative flex items-center px-2 py-1.5">
            {tabs.map((tab) => {
              if (tab.isCreate) {
                return (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    aria-label={tab.label}
                    data-tour="nav-create"
                    className="flex flex-1"
                  >
                    <NavItemContent tab={tab} loading={loading} activeOverride={createOpen} />
                  </button>
                );
              }
              return <NavTab key={tab.label} tab={tab} loading={loading} />;
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
