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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
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
      alert(data.error ?? "Failed to start checkout. Please try again.");
    }
  }

  const bestValueId = findBestValue(packages);

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Post Credits</span>
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
                Payment successful! Your credits have been added.
              </p>
            </motion.div>
          )}
          {isCancelled && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-3"
            >
              <p className="text-[13px] text-zinc-400">
                Checkout was cancelled. No charge was made.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Credit balance card */}
        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-amber-400/0 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-400/15">
              <Coins size={22} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                Your balance
              </p>
              <p className="text-[28px] font-bold leading-none text-white">
                {loading ? "—" : balance}
                <span className="ml-1.5 text-[14px] font-medium text-zinc-500">
                  credit{balance !== 1 ? "s" : ""}
                </span>
              </p>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-500">
            Each feed post costs 1 credit. Stories are always free.
          </p>
        </div>

        {/* Package cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-zinc-900 px-4 py-10 text-center">
            <Package size={28} className="mx-auto mb-3 text-zinc-700" />
            <p className="text-[14px] text-zinc-400">No packages available right now</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              Choose a package
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
                      ? "border-amber-400/30 bg-amber-400/5"
                      : "border-white/5 bg-zinc-900"
                  )}
                >
                  {/* Best value badge */}
                  {isBest && (
                    <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5">
                      <Sparkles size={10} className="text-zinc-950" />
                      <span className="text-[10px] font-bold text-zinc-950">BEST VALUE</span>
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                      isBest ? "bg-amber-400/15 text-amber-400" : "bg-zinc-800 text-zinc-400"
                    )}>
                      <Zap size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-white">{pkg.name}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[20px] font-bold text-amber-400">
                          {formatPrice(pkg.price)}
                        </span>
                        <span className="text-[12px] text-zinc-500">
                          {pkg.post_credits} credits
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                        <span>{pricePerPost(pkg.price, pkg.post_credits)}/post</span>
                        {pkg.validity_days && (
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            Valid {pkg.validity_days} days
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="mt-2 text-[12px] text-zinc-500">{pkg.description}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleBuy(pkg.id)}
                    disabled={!!buying}
                    className={cn(
                      "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-semibold transition-all",
                      isBest
                        ? "bg-amber-400 text-zinc-950 hover:bg-amber-300 active:scale-[0.98]"
                        : "bg-zinc-800 text-white hover:bg-zinc-700 active:scale-[0.98]",
                      buying && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {isBuying ? (
                      <><Loader2 size={14} className="animate-spin" /> Processing…</>
                    ) : (
                      `Buy ${pkg.post_credits} Credits`
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
            <p className="mb-3 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              Purchase history
            </p>
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900 px-4 py-3"
                >
                  <div>
                    <p className="text-[13px] font-medium text-zinc-300">
                      {h.credits_purchased} credits purchased
                    </p>
                    <p className="text-[11px] text-zinc-600">{formatDate(h.purchased_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      "text-[13px] font-semibold",
                      h.credits_remaining > 0 ? "text-emerald-400" : "text-zinc-500"
                    )}>
                      {h.credits_remaining} left
                    </p>
                    {h.expires_at && (
                      <p className="text-[10px] text-zinc-600">
                        Expires {formatDate(h.expires_at)}
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-500" />
      </div>
    }>
      <PackagesPageContent />
    </Suspense>
  );
}
