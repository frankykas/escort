"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-gray-100 hover:text-slate-700",
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft size={18} />
    </button>
  );
}
