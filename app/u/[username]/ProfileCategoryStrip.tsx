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
    <section className="border-t border-gray-200 bg-[#fafbfc] py-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex items-center gap-2">
          <Grid3X3 size={13} className="text-pink-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {t("cat_browse")}
          </span>
        </div>
        <Link
          href="/categories"
          className="flex items-center gap-0.5 text-[11px] font-medium text-pink-500 transition-colors hover:text-pink-400"
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
                  ? "border-pink-300 bg-pink-50 text-pink-500"
                  : "border-gray-200 bg-white text-slate-500 hover:border-gray-300 hover:text-slate-700"
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
