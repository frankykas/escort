"use client";

import Link from "next/link";
import { Grid3X3, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  serviceCategories: string[];
};

export function ProfileCategoryStrip({ serviceCategories }: Props) {
  // Match this provider's service_categories to browsable categories
  const matched = CATEGORIES.filter((cat) => {
    if (cat.filter.type === "service" || cat.filter.type === "tag") {
      return serviceCategories.includes(String(cat.filter.value));
    }
    return false;
  });

  // Show matched categories first, then fill with popular ones
  const matchedSlugs = new Set(matched.map((c) => c.slug));
  const others = CATEGORIES.filter((c) => !matchedSlugs.has(c.slug));
  const display: Category[] = [...matched, ...others];

  const { t } = useTranslation();

  return (
    <section className="border-t border-white/5 bg-zinc-950 py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2">
          <Grid3X3 size={13} className="text-amber-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            {t("cat_browse")}
          </span>
        </div>
        <Link
          href="/categories"
          className="flex items-center gap-0.5 text-[11px] font-medium text-amber-400 transition-colors hover:text-amber-300"
        >
          {t("cat_view_all")}
          <ChevronRight size={12} />
        </Link>
      </div>

      {/* Scrollable pills */}
      <div className="flex items-center gap-2 overflow-x-auto px-4 pb-1 scrollbar-hide">
        {display.map((cat) => {
          const isMatched = matchedSlugs.has(cat.slug);
          return (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={cn(
                "flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.96]",
                isMatched
                  ? "border-amber-400/25 bg-amber-400/10 text-amber-400"
                  : "border-white/8 bg-zinc-900/80 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
              )}
            >
              <span className="text-[13px]">{cat.emoji}</span>
              {cat.shortLabel}
            </Link>
          );
        })}
        <div className="w-2 flex-shrink-0" />
      </div>
    </section>
  );
}
