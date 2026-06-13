"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

interface TipSheetProps {
  /** Creator profile id receiving the tip. */
  creatorId: string;
  creatorName: string;
  open: boolean;
  onClose: () => void;
  onError?: (message: string) => void;
}

// Preset tip amounts in cents.
const PRESETS = [500, 1000, 2500, 5000, 10000];

function formatUsd(cents: number): string {
  return `CA$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/**
 * Bottom sheet for sending a variable-amount tip. Opens a PayRam checkout and
 * redirects to the hosted payment page on confirm.
 */
export default function TipSheet({
  creatorId,
  creatorName,
  open,
  onClose,
  onError,
}: TipSheetProps) {
  const [selected, setSelected] = useState<number>(PRESETS[1]);
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);

  const customCents = custom ? Math.round(parseFloat(custom) * 100) : 0;
  const amountCents = customCents > 0 ? customCents : selected;
  const valid = Number.isInteger(amountCents) && amountCents >= 100 && amountCents <= 1_000_000;

  async function send() {
    if (loading || !valid) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "tip", referenceId: creatorId, amountCents }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.url) {
        onError?.(res.status === 401 ? "Please sign in to continue." : data.error ?? "Could not start tip.");
        return;
      }
      window.location.href = data.url as string;
    } catch {
      onError?.("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 rounded-t-3xl bg-white px-5 pb-8 pt-4"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-pink-500" />
                <span className="text-[16px] font-semibold text-slate-800">
                  Tip @{creatorName}
                </span>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              {PRESETS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => {
                    setSelected(amt);
                    setCustom("");
                  }}
                  className={cn(
                    "rounded-2xl border py-3 text-[15px] font-semibold transition",
                    !custom && selected === amt
                      ? "border-pink-300 bg-pink-50 text-pink-600"
                      : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
                  )}
                >
                  {formatUsd(amt)}
                </button>
              ))}
            </div>

            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
              <span className="text-[15px] font-semibold text-pink-500">CA$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Custom amount"
                className="flex-1 bg-transparent text-[16px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
              />
            </div>

            <button
              onClick={send}
              disabled={loading || !valid}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(246,51,154)] py-4 text-[15px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading ? "Starting…" : `Send ${formatUsd(amountCents)} tip`}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
