"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, Compass, MessageCircle, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/messages/"];

// Inner component uses useSearchParams — must be inside Suspense
function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSession();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setUsername(null); return; }
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  if (HIDDEN_ON.some((p) => pathname.startsWith(p)) || HIDDEN_ON.includes(pathname)) return null;

  const profileHref = "/profile";
  const tab = searchParams.get("tab");

  type TabDef = {
    label: string;
    icon: React.ElementType;
    href: string;
    active: boolean;
    unbuilt?: boolean;
  };

  const tabs: TabDef[] = [
    {
      label: "Home",
      icon: Home,
      href: "/",
      active: pathname === "/" && tab !== "favorites",
    },
    {
      label: "Explore",
      icon: Compass,
      href: "/explore",
      active: pathname.startsWith("/explore"),
    },
    {
      label: "Messages",
      icon: MessageCircle,
      href: "/messages",
      active: pathname.startsWith("/messages"),
    },
    {
      label: "Favorites",
      icon: Heart,
      href: "/?tab=favorites",
      active: pathname === "/" && tab === "favorites",
    },
    {
      label: "Profile",
      icon: User,
      href: profileHref,
      active: pathname.startsWith("/profile") || (!!username && pathname === `/u/${username}`),
    },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-label={tab.label}
              tabIndex={tab.unbuilt ? -1 : undefined}
              className={cn(
                "flex flex-col items-center gap-[3px] py-3 px-4 transition-all duration-150",
                tab.active ? "text-white" : "text-zinc-600",
                tab.unbuilt && "pointer-events-none opacity-25"
              )}
            >
              <Icon
                size={24}
                strokeWidth={tab.active ? 2.5 : 1.8}
                className={cn(
                  "transition-all duration-150",
                  tab.active && "drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]",
                  tab.label === "Favorites" && tab.active && "fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                )}
              />
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

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
