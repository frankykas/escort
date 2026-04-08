"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES, getFeaturedCategories } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ─── Explore page grid (gradient cards) ─────────────────────────────────────

export function CategoryGrid() {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const featured = getFeaturedCategories();
  const displayCategories = expanded ? CATEGORIES : featured;

  return (
    <div className="border-b border-white/5 bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Grid3X3 size={13} className="text-[#FCBA03]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            {t("cat_browse")}
          </span>
        </div>
        <Link
          href="/categories"
          className="flex items-center gap-0.5 text-[11px] font-medium text-[#FCBA03] transition-colors hover:text-[#fdd44b]"
        >
          {t("cat_view_all")}
          <ChevronRight size={12} />
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-3">
        {displayCategories.map((cat, i) => (
          <CategoryCard key={cat.slug} category={cat} index={i} />
        ))}
      </div>

      {/* Expand/collapse */}
      {!expanded && CATEGORIES.length > featured.length && (
        <button
          onClick={() => setExpanded(true)}
          className="flex w-full items-center justify-center gap-1 pb-3 text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {t("cat_show_all")} {CATEGORIES.length} {t("cat_categories")}
          <ChevronDown size={12} />
        </button>
      )}
    </div>
  );
}

function CategoryCard({ category, index }: { category: Category; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, delay: index * 0.02 }}
    >
      <Link
        href={`/category/${category.slug}`}
        className="group block"
      >
        <div
          className={cn(
            "relative flex h-[72px] items-end overflow-hidden rounded-xl bg-gradient-to-br p-2.5",
            category.color,
            "transition-all duration-300 group-hover:shadow-lg group-hover:shadow-black/40 group-active:scale-[0.97]"
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="absolute right-2 top-1.5 text-[18px] opacity-40 group-hover:opacity-60 transition-opacity">
            {category.emoji}
          </span>
          <span className="relative z-10 text-[11px] font-bold leading-tight text-white drop-shadow-md">
            {category.shortLabel}
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Collapsible category strip (for home/social feed) ──────────────────────

export function CategoryStrip() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const featured = getFeaturedCategories();

  return (
    <div className="border-b border-white/5">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Grid3X3 size={13} className="text-[#FCBA03]" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            {t("cat_browse")}
          </span>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={14} className="text-zinc-600" />
        </motion.div>
      </button>

      {/* Collapsible text list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 px-5 pb-3">
              {featured.map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.025 }}
                >
                  <Link
                    href={`/category/${cat.slug}`}
                    className="group flex items-center gap-2 rounded-lg py-2 transition-colors"
                  >
                    <span className="text-[13px] text-zinc-500 transition-colors group-hover:text-zinc-300">
                      {cat.shortLabel}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* View all link */}
            <div className="px-5 pb-3">
              <Link
                href="/categories"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FCBA03] transition-colors hover:text-[#fdd44b]"
              >
                {t("cat_view_all")} {CATEGORIES.length} {t("cat_categories")}
                <ChevronRight size={11} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Full categories page grid (premium cards) ──────────────────────────────

export function FullCategoryGrid() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      {CATEGORIES.map((cat, i) => (
        <motion.div
          key={cat.slug}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.03, ease: "easeOut" }}
        >
          <Link href={`/category/${cat.slug}`} className="group block">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#141414] transition-all duration-300 group-hover:border-[#FCBA03]/20 group-hover:shadow-[0_0_24px_rgba(252,186,3,0.06)] group-active:scale-[0.98] glow-card">
              {/* Top accent line */}
              <div className={cn(
                "h-[3px] w-full bg-gradient-to-r opacity-60 transition-opacity group-hover:opacity-100",
                cat.color
              )} />

              <div className="px-4 pt-4 pb-4">
                {/* Emoji + label row */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-[14px] font-semibold tracking-tight text-zinc-100 group-hover:text-white transition-colors">
                      {cat.shortLabel}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-600 line-clamp-2">
                      {cat.description}
                    </p>
                  </div>
                  <span className="ml-3 text-[22px] opacity-50 group-hover:opacity-80 transition-opacity flex-shrink-0">
                    {cat.emoji}
                  </span>
                </div>

                {/* Browse link */}
                <div className="mt-3 flex items-center gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FCBA03]/70 group-hover:text-[#FCBA03] transition-colors">
                    {t("cat_browse_cta")}
                  </span>
                  <ChevronRight size={10} className="text-[#FCBA03]/50 group-hover:text-[#FCBA03] group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
