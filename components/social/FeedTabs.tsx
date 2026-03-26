"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export function FeedTabs() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "favorites" ? "favorites" : "for-you";

  return (
    <div className="flex items-center justify-center border-b border-zinc-800 bg-black">
      <Link
        href="/"
        className={cn(
          "flex-1 max-w-[160px] py-3 text-center text-[13px] font-semibold transition-colors",
          activeTab === "for-you"
            ? "text-white border-b-2 border-white -mb-px"
            : "text-zinc-600 hover:text-zinc-400"
        )}
      >
        For You
      </Link>
      <Link
        href="/?tab=favorites"
        className={cn(
          "flex-1 max-w-[160px] py-3 text-center text-[13px] font-semibold transition-colors",
          activeTab === "favorites"
            ? "text-white border-b-2 border-white -mb-px"
            : "text-zinc-600 hover:text-zinc-400"
        )}
      >
        Favorites
      </Link>
    </div>
  );
}
