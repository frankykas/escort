"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { useProfile } from "@/contexts/ProfileContext";
import { NotificationBell } from "./NotificationBell";

const HIDDEN_ON = ["/auth/signin", "/auth/signup", "/messages/", "/notifications"];

function TopBarInner() {
  const pathname = usePathname();
  const { profile, loading } = useProfile();

  // Hide on auth pages, message threads, and the notifications page itself
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;
  if (loading || !profile) return null;

  return (
    <div className="fixed top-0 right-0 z-50 p-3 pointer-events-none">
      <div className="pointer-events-auto">
        <NotificationBell />
      </div>
    </div>
  );
}

export function TopBar() {
  return (
    <Suspense fallback={null}>
      <TopBarInner />
    </Suspense>
  );
}
