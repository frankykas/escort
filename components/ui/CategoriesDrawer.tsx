"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
};

export function CategoriesDrawer({ onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-gray-200 bg-white"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-800">
            Browse categories
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-gray-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grid */}
        <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: "calc(85vh - 120px)" }}>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
              >
                <Link
                  href={`/category/${cat.slug}`}
                  onClick={onClose}
                  className="group block"
                >
                  <div
                    className={cn(
                      "relative flex h-[88px] items-end overflow-hidden rounded-2xl bg-gradient-to-br p-3",
                      cat.color,
                      "transition-all duration-200 group-active:scale-[0.97]"
                    )}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute right-2.5 top-2 text-[22px] opacity-50 transition-opacity group-hover:opacity-80">
                      {cat.emoji}
                    </span>
                    <span className="relative z-10 text-[12px] font-bold leading-tight text-white drop-shadow-md">
                      {cat.shortLabel}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* View all link */}
          <Link
            href="/categories"
            onClick={onClose}
            className="mt-5 flex items-center justify-center gap-1 rounded-full border border-gray-200 bg-gray-50 py-3 text-[12px] font-semibold text-pink-500 transition-colors hover:border-pink-300"
          >
            View full categories page
            <ChevronRight size={14} />
          </Link>
        </div>
      </motion.div>
    </>
  );
}
