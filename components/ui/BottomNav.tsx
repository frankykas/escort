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

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/messages/"];

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabDef = {
  label: string;
  icon: React.ElementType;
  href: string;
  active: boolean;
};

function useClientTabs(pathname: string): TabDef[] {
  return [
    {
      label: "Home",
      icon: Home,
      href: "/",
      active: pathname === "/",
    },
    {
      label: "Explore",
      icon: Compass,
      href: "/explore",
      active: pathname.startsWith("/explore"),
    },
    {
      label: "Listings",
      icon: LayoutGrid,
      href: "/listings",
      active: pathname.startsWith("/listings"),
    },
    {
      label: "Messages",
      icon: MessageCircle,
      href: "/messages",
      active: pathname.startsWith("/messages"),
    },
    {
      label: "Profile",
      icon: User,
      href: "/profile",
      active: pathname.startsWith("/profile"),
    },
  ];
}

function useProviderTabs(pathname: string): TabDef[] {
  return [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/",
      active: pathname === "/",
    },
    {
      label: "Bookings",
      icon: CalendarCheck,
      href: "/profile/bookings",
      active: pathname === "/profile/bookings",
    },
    {
      label: "Messages",
      icon: MessageCircle,
      href: "/messages",
      active: pathname.startsWith("/messages"),
    },
    {
      label: "Listings",
      icon: ListOrdered,
      href: "/profile/listings",
      active:
        pathname === "/profile/listings" ||
        pathname === "/profile/upload",
    },
    {
      label: "Profile",
      icon: User,
      href: "/profile",
      active:
        pathname.startsWith("/profile") &&
        pathname !== "/profile/bookings" &&
        pathname !== "/profile/listings" &&
        pathname !== "/profile/upload",
    },
  ];
}

// ─── Inner nav (needs useSearchParams → must be inside Suspense) ──────────────

function BottomNavInner() {
  const pathname = usePathname();
  const { profile, isProvider, loading } = useProfile();

  const clientTabs = useClientTabs(pathname);
  const providerTabs = useProviderTabs(pathname);

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
