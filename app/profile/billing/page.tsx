"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ChevronLeft, CreditCard, Crown, ArrowUpRight,
  ShieldCheck, Zap, Clock, CheckCircle,
} from "lucide-react";
import { useSession } from "@/hooks/useSession";

const FEATURES = [
  "Accept subscriptions from fans and clients",
  "Pay-per-view premium content",
  "Bump listings to the top of search",
  "Instant payouts to your bank account",
  "Detailed earnings analytics",
];

const PAYOUT_INFO = [
  { label: "Payout schedule",   value: "Weekly (every Monday)" },
  { label: "Minimum payout",    value: "CA$25" },
  { label: "Platform fee",      value: "15% of earnings" },
  { label: "Payment processor", value: "Stripe" },
  { label: "Currencies",        value: "CAD, USD" },
];

export default function BillingPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked]);

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Billing &amp; Payments</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-8 space-y-8">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-400/5 border border-emerald-400/20">
            <CreditCard size={36} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white">Payments</h1>
            <p className="mt-1.5 text-[14px] text-zinc-400 leading-relaxed">
              Earn from subscriptions, premium content, and bumped listings — all paid out securely via Stripe.
            </p>
          </div>
        </div>

        {/* Earnings summary placeholder */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "This month",    value: "CA$0",  icon: Crown,  color: "text-amber-400" },
            { label: "All time",      value: "CA$0",  icon: Zap,    color: "text-emerald-400" },
            { label: "Pending payout",value: "CA$0",  icon: Clock,  color: "text-sky-400" },
            { label: "Subscribers",   value: "0",     icon: Crown,  color: "text-violet-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4">
              <Icon size={16} className={color} />
              <p className="mt-2 text-[22px] font-bold text-white">{value}</p>
              <p className="text-[11px] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <div>
          <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">What you can earn</p>
          <div className="rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3 px-4 py-3.5">
                <CheckCircle size={15} className="flex-shrink-0 text-emerald-400 fill-emerald-400/20" />
                <span className="text-[13px] text-zinc-300">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payout info */}
        <div>
          <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Payout details</p>
          <div className="rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5">
            {PAYOUT_INFO.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-[13px] text-zinc-400">{label}</span>
                <span className="text-[13px] font-medium text-white">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stripe connect */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-4">
            <ShieldCheck size={16} className="flex-shrink-0 text-zinc-500" />
            <p className="text-[12px] text-zinc-500 leading-relaxed">
              All payments are processed by Stripe. Cleopatra never stores card details. Payouts go directly to your connected bank account.
            </p>
          </div>
          <button
            disabled
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-800 py-4 text-[15px] font-semibold text-zinc-500 cursor-not-allowed"
          >
            <ArrowUpRight size={18} />
            Connect Stripe Account — Coming Soon
          </button>
          <p className="text-center text-[12px] text-zinc-600">
            Stripe Connect integration is being configured. You'll be notified when it's ready.
          </p>
        </div>
      </div>
    </div>
  );
}
