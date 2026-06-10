"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Wallet, Clock, TrendingUp, Loader2, ArrowDownToLine,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/api-fetch";

type Balance = { available: number; pending: number; lifetime: number };
type Payout = {
  id: string;
  amount: number;
  status: "requested" | "processing" | "paid" | "failed";
  requested_at: string;
  paid_at: string | null;
};

const PAYOUT_STATUS = {
  requested:  { label: "Requested",  color: "text-amber-600",   bg: "bg-amber-50" },
  processing: { label: "Processing", color: "text-sky-600",     bg: "bg-sky-50" },
  paid:       { label: "Paid",       color: "text-emerald-600", bg: "bg-emerald-50" },
  failed:     { label: "Failed",     color: "text-red-600",     bg: "bg-red-50" },
};

function money(cents: number): string {
  return `CA$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function EarningsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [balance, setBalance] = useState<Balance>({ available: 0, pending: 0, lifetime: 0 });
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, checked]);

  async function load() {
    const res = await apiFetch("/api/payouts");
    if (res.ok) {
      const data = await res.json();
      setBalance(data.balance);
      setPayouts(data.payouts ?? []);
    }
    setLoading(false);
  }

  async function requestPayout() {
    if (requesting || balance.available <= 0) return;
    setRequesting(true);
    const res = await apiFetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountCents: balance.available }),
    });
    const data = await res.json().catch(() => ({}));
    setRequesting(false);

    if (res.ok) {
      showToast("Payout requested", true);
      void load();
    } else {
      showToast(data.error ?? "Could not request payout", false);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">Earnings</span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {/* Available balance */}
          <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5">
            <div className="mb-1 flex items-center gap-2">
              <Wallet size={16} className="text-pink-500" />
              <span className="text-[12px] font-medium uppercase tracking-widest text-pink-500">
                Available
              </span>
            </div>
            <p className="text-[32px] font-bold text-slate-800">{money(balance.available)}</p>
            <button
              onClick={requestPayout}
              disabled={requesting || balance.available <= 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(246,51,154)] py-3.5 text-[14px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
            >
              {requesting ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
              {balance.available > 0 ? `Withdraw ${money(balance.available)}` : "Nothing to withdraw"}
            </button>
          </div>

          {/* Pending + lifetime */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Pending</span>
              </div>
              <p className="text-[20px] font-bold text-slate-800">{money(balance.pending)}</p>
              <p className="text-[11px] text-slate-400">Clearing the hold window</p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-slate-400" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-slate-400">Lifetime</span>
              </div>
              <p className="text-[20px] font-bold text-slate-800">{money(balance.lifetime)}</p>
              <p className="text-[11px] text-slate-400">Gross earnings</p>
            </div>
          </div>

          {/* Payout history */}
          <div>
            <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">
              Payout history
            </p>
            {payouts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center">
                <p className="text-[13px] text-slate-400">No payouts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map((p) => {
                  const cfg = PAYOUT_STATUS[p.status];
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3.5"
                    >
                      <div>
                        <p className="text-[15px] font-semibold text-slate-800">{money(p.amount)}</p>
                        <p className="text-[11px] text-slate-400">
                          {formatDate(p.paid_at ?? p.requested_at)}
                        </p>
                      </div>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", cfg.bg, cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-center text-[12px] text-slate-400">
            Funds clear from pending to available after a hold window, then can be withdrawn to your payout destination.
          </p>
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={cn(
              "fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-medium text-white shadow-xl",
              toast.ok ? "bg-emerald-500" : "bg-red-500"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
