"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, Coins, Loader2, CheckCircle, Sparkles, Zap,
  Clock, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useSession } from "@/hooks/useSession";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostingPackage = {
  id: string;
  name: string;
  description: string | null;
  post_credits: number;
  price: number; // cents
  validity_days: number | null;
  sort_order: number;
};

type PurchaseRecord = {
  id: string;
  package_id: string;
  credits_purchased: number;
  credits_remaining: number;
  purchased_at: string;
  expires_at: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number): string {
  return `CA$${(cents / 100).toFixed(2)}`;
}

function pricePerPost(cents: number, credits: number): string {
  return `CA$${(cents / credits / 100).toFixed(2)}`;
}

function formatDate(iso: string, locale: string): string {
  // Map our 2-letter locale to a BCP-47 tag for Intl.
  const tag = locale === "fr" ? "fr-CA" : "en-CA";
  return new Date(iso).toLocaleDateString(tag, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Best value = lowest price-per-credit
function findBestValue(packages: PostingPackage[]): string | null {
  if (packages.length < 2) return null;
  let bestId = packages[0].id;
  let bestPpc = packages[0].price / packages[0].post_credits;
  for (const pkg of packages) {
    const ppc = pkg.price / pkg.post_credits;
    if (ppc < bestPpc) {
      bestPpc = ppc;
      bestId = pkg.id;
    }
  }
  return bestId;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function PackagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checked } = useSession();
  const { t, locale } = useTranslation();

  const [packages, setPackages] = useState<PostingPackage[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [history, setHistory] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  const isSuccess = searchParams.get("success") === "1";
  const isCancelled = searchParams.get("cancelled") === "1";

  useEffect(() => {
    if (!user) return;
    apiFetch(`/api/packages?includeOwn=1`)
      .then((r) => r.json())
      .then((data) => {
        setPackages(data.packages ?? []);
        setBalance(data.balance ?? 0);
        setHistory(data.history ?? []);
        setLoading(false);
      });
  }, [user]);

  // Refresh after successful purchase
  useEffect(() => {
    if (isSuccess && user) {
      apiFetch(`/api/packages?includeOwn=1`)
        .then((r) => r.json())
        .then((data) => {
          setBalance(data.balance ?? 0);
          setHistory(data.history ?? []);
        });
    }
  }, [isSuccess, user]);

  if (checked && !user) {
    router.replace("/auth/signin");
    return null;
  }

  async function handleBuy(packageId: string) {
    if (!user || buying) return;
    setBuying(packageId);

    const res = await apiFetch("/api/packages/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });

    const data = await res.json();
    setBuying(null);

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error ?? t("pkg_checkout_failed"));
    }
  }

  const bestValueId = findBestValue(packages);

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("pkg_header")}</span>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-5">
        {/* Success / cancelled banners */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
            >
              <CheckCircle size={18} className="text-emerald-400" />
              <p className="text-[13px] text-emerald-300">
                {t("pkg_payment_success")}
              </p>
            </motion.div>
          )}
          {isCancelled && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
              <p className="text-[13px] text-slate-500">
                {t("pkg_payment_cancelled")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Credit balance card */}
        <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-transparent p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50">
              <Coins size={22} className="text-pink-500" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400">
                {t("credits_your_balance")}
              </p>
              <p className="text-[28px] font-bold leading-none text-slate-800">
                {loading ? "—" : balance}
                <span className="ml-1.5 text-[14px] font-medium text-slate-400">
                  {balance !== 1 ? t("credits_credits") : t("credits_credit")}
                </span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">
            {t("credits_feed_cost_note")}
          </p>
        </div>

        {/* Package cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center">
            <Package size={28} className="mx-auto mb-3 text-slate-300" />
            <p className="text-[14px] text-slate-500">{t("pkg_no_packages")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-slate-300">
              {t("pkg_choose_header")}
            </p>
            {packages.map((pkg) => {
              const isBest = pkg.id === bestValueId;
              const isBuying = buying === pkg.id;

              return (
                <motion.div
                  key={pkg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-4 transition-all",
                    isBest
                      ? "border-pink-300 bg-pink-50"
                      : "border-gray-200 bg-white"
                  )}
                >
                  {/* Best value badge */}
                  {isBest && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-pink-400 px-2.5 py-0.5">
                      <Sparkles size={10} className="text-white" />
                      <span className="text-[10px] font-bold text-white">{t("pkg_best_value")}</span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                      isBest ? "bg-pink-100 text-pink-500" : "bg-gray-100 text-slate-500"
                    )}>
                      <Zap size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-slate-800">{pkg.name}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[20px] font-bold text-pink-500">
                          {formatPrice(pkg.price)}
                        </span>
                        <span className="text-[12px] text-slate-400">
                          {pkg.post_credits} {t("credits_credits")}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span>{pricePerPost(pkg.price, pkg.post_credits)}{t("pkg_per_post")}</span>
                        {pkg.validity_days && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {t("pkg_valid_days").replace("{n}", String(pkg.validity_days))}
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="mt-2 text-[12px] text-slate-400">{pkg.description}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuy(pkg.id)}
                    disabled={!!buying}
                    className={cn(
                      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all",
                      isBest
                        ? "bg-pink-400 text-white hover:bg-pink-300 active:scale-[0.98]"
                        : "bg-gray-100 text-slate-800 hover:bg-gray-200 active:scale-[0.98]",
                      buying && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isBuying ? (
                      <><Loader2 size={14} className="animate-spin" /> {t("pkg_processing")}</>
                    ) : (
                      t("pkg_buy_n_credits").replace("{n}", String(pkg.post_credits))
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Purchase history */}
        {history.length > 0 && (
          <div>
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-slate-300">
              {t("credits_history")}
            </p>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-slate-600">
                      {t("pkg_purchased_row").replace("{n}", String(h.credits_purchased))}
                    </p>
                    <p className="text-[11px] text-slate-300">{formatDate(h.purchased_at, locale)}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-[13px] font-semibold",
                      h.credits_remaining > 0 ? "text-emerald-400" : "text-slate-400"
                    )}>
                      {t("pkg_left").replace("{n}", String(h.credits_remaining))}
                    </p>
                    {h.expires_at && (
                      <p className="text-[10px] text-slate-300">
                        {t("pkg_expires_date").replace("{date}", formatDate(h.expires_at, locale))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PackagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    }>
      <PackagesPageContent />
    </Suspense>
  );
}
