"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, CreditCard, Coins,
  ShieldCheck, CheckCircle, Package, Clock, Megaphone,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Purchase = {
  id: string;
  credits_purchased: number;
  credits_remaining: number;
  purchased_at: string;
  expires_at: string | null;
  posting_packages: { name: string } | null;
};

export default function BillingPage() {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const { user, checked } = useSession();
  const [creditBalance, setCreditBalance] = useState(0);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;

    const [profileRes, purchasesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("post_credits_balance")
        .eq("id", user.id)
        .single(),
      supabase
        .from("posting_package_purchases")
        .select("id, credits_purchased, credits_remaining, purchased_at, expires_at, posting_packages:package_id(name)")
        .eq("provider_id", user.id)
        .order("purchased_at", { ascending: false })
        .limit(20),
    ]);

    setCreditBalance(profileRes.data?.post_credits_balance ?? 0);
    setPurchases((purchasesRes.data ?? []) as unknown as Purchase[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
    else load();
  }, [user, checked, load, router]);

  const totalSpent = purchases.reduce((sum, p) => sum + p.credits_purchased, 0);
  const totalUsed = purchases.reduce((sum, p) => sum + (p.credits_purchased - p.credits_remaining), 0);

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("credits_header_billing")}</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-6">

        {/* Credit balance hero */}
        <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-transparent p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50">
            <Coins size={28} className="text-pink-500" />
          </div>
          <p className="mt-4 text-[36px] font-bold text-slate-800 leading-none">
            {loading ? "—" : creditBalance}
          </p>
          <p className="mt-1 text-[14px] text-slate-500">{t("credits_available")}</p>
          <Link
            href="/profile/packages"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-pink-400 px-6 py-3 text-[14px] font-bold text-white transition hover:bg-pink-300 active:scale-[0.98]"
          >
            <Package size={16} />
            {t("credits_buy")}
          </Link>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
              <CreditCard size={14} className="text-sky-400" />
              <p className="mt-2 text-[22px] font-bold text-slate-800">{totalSpent}</p>
              <p className="text-[11px] text-slate-400">{t("credits_purchased")}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
              <CheckCircle size={14} className="text-emerald-400" />
              <p className="mt-2 text-[22px] font-bold text-slate-800">{totalUsed}</p>
              <p className="text-[11px] text-slate-400">{t("credits_used")}</p>
            </div>
          </div>
        )}

        {/* What credits are used for */}
        <div>
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-300">{t("credits_used_for_header")}</p>
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {[
              { text: t("billing_first_free"), highlight: true },
              { text: t("credits_use_bump") },
              { text: t("credits_use_star") },
              { text: t("credits_use_post") },
            ].map(({ text, highlight }) => (
              <div key={text} className="flex items-center gap-3 px-4 py-3.5">
                <CheckCircle size={14} className={`flex-shrink-0 ${highlight ? "text-pink-500 fill-pink-500/20" : "text-emerald-400 fill-emerald-400/20"}`} />
                <span className={`text-[13px] ${highlight ? "text-pink-500 font-medium" : "text-slate-600"}`}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bump tiers */}
        <div>
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-300">{t("credits_promote_header")}</p>
          <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
            {[
              { tier: "Tier 1", credits: "1 credit", desc: "Explore Stories (24h)", color: "text-sky-400" },
              { tier: "Tier 2", credits: "2 credits", desc: "Stories + Similar Profiles (24h)", color: "text-violet-400" },
              { tier: "Tier 3", credits: "3 credits", desc: "Stories + Similar Profiles + Feed (24h)", color: "text-pink-500" },
            ].map(({ tier, credits, desc, color }) => (
              <div key={tier} className="flex items-center gap-3 px-4 py-3.5">
                <Megaphone size={14} className={`flex-shrink-0 ${color}`} />
                <div className="flex-1">
                  <span className="text-[13px] text-slate-600">{tier} — {desc}</span>
                </div>
                <span className={`text-[12px] font-semibold ${color}`}>{credits}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase history */}
        <div>
          <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-300">
            {t("credits_history")}
          </p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : purchases.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-6 text-center">
              <Package size={20} className="mx-auto mb-2 text-slate-300" />
              <p className="text-[13px] text-slate-400">{t("credits_no_purchases")}</p>
              <Link
                href="/profile/packages"
                className="mt-2 inline-block text-[13px] font-medium text-pink-500 hover:text-pink-400"
              >
                {t("credits_browse_packages")}
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((p) => {
                const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
                const packageName = (p.posting_packages as { name: string } | null)?.name ?? t("credits_fallback_name");
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-pink-50">
                      <Package size={15} className="text-pink-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 truncate">{packageName}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(p.purchased_at).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-slate-800">
                        {p.credits_remaining}/{p.credits_purchased}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isExpired ? (
                          <span className="text-red-400">{t("billing_expired")}</span>
                        ) : p.expires_at ? (
                          <span className="flex items-center gap-0.5 justify-end">
                            <Clock size={8} /> {t("billing_active")}
                          </span>
                        ) : (
                          t("billing_no_expiry")
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stripe connect info */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4">
          <ShieldCheck size={16} className="flex-shrink-0 text-slate-400" />
          <p className="text-[12px] text-slate-400 leading-relaxed">
            {t("billing_stripe_notice")}
          </p>
        </div>
      </div>
    </div>
  );
}
