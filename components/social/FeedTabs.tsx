"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSection } from "@/contexts/SectionContext";

export function FeedTabs() {
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { isCreatorSection } = useSection();
  const activeTab = searchParams.get("tab") === "favorites" ? "favorites" : "for-you";

  const activeClass = isCreatorSection
    ? "text-violet-500 border-b-2 border-violet-400 -mb-px"
    : "text-pink-500 border-b-2 border-pink-400 -mb-px";

  return (
    <div className="flex items-center justify-center border-b border-gray-200 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
      <Link
        href="/"
        className={cn(
          "flex-1 max-w-[160px] py-3 text-center text-[13px] font-semibold transition-colors",
          activeTab === "for-you" ? activeClass : "text-slate-400 hover:text-slate-600"
        )}
      >
        {t("home_for_you")}
      </Link>
      <Link
        href="/?tab=favorites"
        className={cn(
          "flex-1 max-w-[160px] py-3 text-center text-[13px] font-semibold transition-colors",
          activeTab === "favorites" ? activeClass : "text-slate-400 hover:text-slate-600"
        )}
      >
        {t("home_favorites")}
      </Link>
    </div>
  );
}
