"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Crown, Plus, X, Loader2, Eye, EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Tier = {
  id?: string;
  monthly_rate: number;   // cents
  description: string;
  perks: string[];
  is_active: boolean;
};

export default function SubscriptionTierPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [tier, setTier]       = useState<Tier | null>(null);
  const [loaded, setLoaded]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);

  // Form fields
  const [rate, setRate]           = useState("");       // CA$ display
  const [isFree, setIsFree]       = useState(false);    // $0 subscription
  const [description, setDesc]    = useState("");
  const [perks, setPerks]         = useState<string[]>([""]);
  const [isActive, setIsActive]   = useState(true);

  const perkRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    supabase
      .from("subscription_tiers")
      .select("*")
      .eq("provider_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setTier(data);
          setIsFree(data.monthly_rate === 0);
          setRate(data.monthly_rate === 0 ? "" : String(Math.round(data.monthly_rate / 100)));
          setDesc(data.description ?? "");
          setPerks(data.perks?.length ? data.perks : [""]);
          setIsActive(data.is_active);
        }
        setLoaded(true);
      });
  }, [user, checked]);

  function addPerk() {
    setPerks((p) => [...p, ""]);
    setTimeout(() => perkRefs.current[perks.length]?.focus(), 50);
  }

  function updatePerk(i: number, v: string) {
    setPerks((p) => p.map((x, j) => (j === i ? v : x)));
  }

  function removePerk(i: number) {
    setPerks((p) => p.filter((_, j) => j !== i));
  }

  async function save() {
    if (!user) return;
    const rateNum = parseFloat(rate);
    if (!isFree && (!rate || isNaN(rateNum) || rateNum <= 0)) {
      showToast("Enter a valid monthly rate", false);
      return;
    }
    setSaving(true);
    const cleanPerks = perks.map((p) => p.trim()).filter(Boolean);
    const payload = {
      provider_id:  user.id,
      monthly_rate: isFree ? 0 : Math.round(rateNum * 100),
      description:  description.trim() || null,
      perks:        cleanPerks,
      is_active:    isActive,
    };

    const { data, error } = tier?.id
      ? await supabase.from("subscription_tiers").update(payload).eq("id", tier.id).select().single()
      : await supabase.from("subscription_tiers").insert(payload).select().single();

    setSaving(false);
    if (error) {
      showToast("Failed to save. Please try again.", false);
    } else {
      setTier(data);
      showToast("Subscription tier saved!", true);
    }
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const monthlyDisplay = isFree ? "Free" : rate ? `CA$${parseFloat(rate).toFixed(2)}` : "CA$0.00";

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">Subscription Tier</span>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-[rgb(246,51,154)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save
        </button>
      </header>

      {!loaded ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {/* Live preview card */}
          <div className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={16} className="text-pink-500" />
              <span className="text-[12px] font-medium uppercase tracking-widest text-pink-500">Preview</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[28px] font-bold text-slate-800">{monthlyDisplay}</p>
                <p className="text-[12px] text-slate-500">per month</p>
              </div>
              <span className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                isActive ? "bg-emerald-50 text-emerald-500" : "bg-gray-200 text-slate-500"
              )}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {description && (
              <p className="mt-3 text-[13px] text-slate-500 leading-snug">{description}</p>
            )}
            {perks.filter(Boolean).length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {perks.filter(Boolean).map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[12px] text-slate-600">
                    <span className="h-1 w-1 rounded-full bg-gradient-to-r from-pink-400 to-sky-400 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rate */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Monthly rate</p>
            <div className={cn(
              "flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5 transition",
              isFree && "opacity-40"
            )}>
              <span className="text-[15px] font-semibold text-pink-500">CA$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 19.99"
                disabled={isFree}
                className="flex-1 bg-transparent text-[16px] font-semibold text-slate-800 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
              />
              <span className="text-[13px] text-slate-500">/ month</span>
            </div>

            {/* Free toggle */}
            <button
              onClick={() => setIsFree((v) => !v)}
              className="mt-2 flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3"
            >
              <div className="text-left">
                <p className="text-[14px] font-medium text-slate-800">Free subscription</p>
                <p className="text-[12px] text-slate-500">Free to subscribe — earn from pay-per-view & tips instead</p>
              </div>
              <div className={cn(
                "relative h-6 w-11 flex-shrink-0 rounded-full transition-colors",
                isFree ? "bg-[rgb(246,51,154)]" : "bg-gray-200"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
                  isFree ? "left-[22px]" : "left-0.5"
                )} />
              </div>
            </button>
          </div>

          {/* Description */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What subscribers get — shown on your profile…"
              maxLength={300}
              rows={3}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-[14px] text-slate-800 placeholder-slate-400 outline-none focus:border-pink-300"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{description.length}/300</p>
          </div>

          {/* Perks */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Perks list</p>
            <div className="space-y-2">
              {perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-pink-400 to-sky-400 flex-shrink-0" />
                    <input
                      ref={(el) => { perkRefs.current[i] = el; }}
                      type="text"
                      value={perk}
                      onChange={(e) => updatePerk(i, e.target.value)}
                      placeholder={`Perk ${i + 1}…`}
                      maxLength={100}
                      className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-400 outline-none"
                    />
                  </div>
                  {perks.length > 1 && (
                    <button
                      onClick={() => removePerk(i)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-gray-100 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addPerk}
              className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-[13px] text-slate-500 transition hover:border-gray-400 hover:text-slate-600 w-full justify-center"
            >
              <Plus size={14} />
              Add perk
            </button>
          </div>

          {/* Active toggle */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <button
              onClick={() => setIsActive((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-4"
            >
              <div className="flex items-center gap-3">
                {isActive ? (
                  <Eye size={18} className="text-emerald-500" />
                ) : (
                  <EyeOff size={18} className="text-slate-500" />
                )}
                <div className="text-left">
                  <p className="text-[14px] font-medium text-slate-800">
                    {isActive ? "Subscription is active" : "Subscription is hidden"}
                  </p>
                  <p className="text-[12px] text-slate-500">
                    {isActive ? "Clients can subscribe from your profile" : "Toggle on to allow subscriptions"}
                  </p>
                </div>
              </div>
              <div className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isActive ? "bg-emerald-500" : "bg-gray-200"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
                  isActive ? "left-[22px]" : "left-0.5"
                )} />
              </div>
            </button>
          </div>

          {/* Save button */}
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(246,51,154)] py-4 text-[15px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : tier?.id ? "Update Tier" : "Create Tier"}
          </button>

          <p className="text-center text-[12px] text-slate-400">
            Stripe payments integration is required to start accepting subscriptions. Visit Billing to connect your account.
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
              "fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-medium shadow-xl",
              toast.ok ? "bg-emerald-500 text-slate-800" : "bg-red-500 text-slate-800"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
