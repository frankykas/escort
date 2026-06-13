"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import type { Locale } from "@/lib/i18n";

/**
 * Floating FR/EN toggle — only visible when NEXT_PUBLIC_DEV_MODE=true.
 * Drop it into the root layout. Perfect for demo sessions.
 */
export function LocaleSwitcher() {
  const { locale, setLocale } = useTranslation();

  if (process.env.NEXT_PUBLIC_DEV_MODE !== "true") return null;

  const other: Locale = locale === "en" ? "fr" : "en";
  const labels: Record<Locale, string> = { en: "EN", fr: "FR" };

  return (
    <button
      onClick={() => setLocale(other)}
      className="fixed bottom-[72px] right-4 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white/90 text-[12px] font-bold text-slate-500 shadow-lg backdrop-blur-md transition hover:border-pink-300 hover:text-pink-500"
      aria-label={`Switch to ${other.toUpperCase()}`}
      title={`Switch to ${other.toUpperCase()}`}
    >
      {labels[locale]}
    </button>
  );
}
