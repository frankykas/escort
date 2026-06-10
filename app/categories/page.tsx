"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { FullCategoryGrid } from "@/components/ui/CategoryGrid";
import { BottomNav } from "@/components/ui/BottomNav";

export default function CategoriesPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      {/* ── Premium header ── */}
      <div className="relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-pink-200/30 blur-[80px]" />

        <header className="relative z-10 flex items-center gap-3 px-4 pt-5 pb-2">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-500 backdrop-blur-md transition-all hover:border-gray-300 hover:text-slate-800 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>
        </header>

        <div className="relative z-10 px-5 pb-6 pt-1">
          <h1 className="text-[24px] font-bold tracking-tight text-slate-800">
            All Categories
          </h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
            Browse providers by speciality, look, or lifestyle.
          </p>
        </div>

        {/* Separator */}
        <div className="mx-5 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
      </div>

      <div className="pt-5 pb-4">
        <FullCategoryGrid />
      </div>

      <BottomNav />
    </div>
  );
}
