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
          setRate(String(Math.round(data.monthly_rate / 100)));
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
    if (!rate || isNaN(rateNum) || rateNum <= 0) {
      showToast("Enter a valid monthly rate", false);
      return;
    }
    setSaving(true);
    const cleanPerks = perks.map((p) => p.trim()).filter(Boolean);
    const payload = {
      provider_id:  user.id,
      monthly_rate: Math.round(rateNum * 100),
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

  const monthlyDisplay = rate ? `CA$${parseFloat(rate).toFixed(2)}` : "CA$0.00";

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Subscription Tier</span>
        <button
          onClick={save}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-1.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Save
        </button>
      </header>

      {!loaded ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {/* Live preview card */}
          <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/5 to-zinc-900 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Crown size={16} className="text-amber-400" />
              <span className="text-[12px] font-medium uppercase tracking-widest text-amber-400">Preview</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[28px] font-bold text-white">{monthlyDisplay}</p>
                <p className="text-[12px] text-zinc-500">per month</p>
              </div>
              <span className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700 text-zinc-500"
              )}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {description && (
              <p className="mt-3 text-[13px] text-zinc-400 leading-snug">{description}</p>
            )}
            {perks.filter(Boolean).length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {perks.filter(Boolean).map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[12px] text-zinc-300">
                    <span className="h-1 w-1 rounded-full bg-amber-400 flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Rate */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Monthly rate</p>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3.5">
              <span className="text-[15px] font-semibold text-amber-400">CA$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 19.99"
                className="flex-1 bg-transparent text-[16px] font-semibold text-white placeholder-zinc-600 outline-none"
              />
              <span className="text-[13px] text-zinc-500">/ month</span>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What subscribers get — shown on your profile…"
              maxLength={300}
              rows={3}
              className="w-full resize-none rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3.5 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-amber-400/30"
            />
            <p className="mt-1 text-right text-[11px] text-zinc-600">{description.length}/300</p>
          </div>

          {/* Perks */}
          <div>
            <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Perks list</p>
            <div className="space-y-2">
              {perks.map((perk, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-3 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                    <input
                      ref={(el) => { perkRefs.current[i] = el; }}
                      type="text"
                      value={perk}
                      onChange={(e) => updatePerk(i, e.target.value)}
                      placeholder={`Perk ${i + 1}…`}
                      maxLength={100}
                      className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
                    />
                  </div>
                  {perks.length > 1 && (
                    <button
                      onClick={() => removePerk(i)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-zinc-600 transition hover:bg-zinc-800 hover:text-zinc-300"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addPerk}
              className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-[13px] text-zinc-500 transition hover:border-white/25 hover:text-zinc-300 w-full justify-center"
            >
              <Plus size={14} />
              Add perk
            </button>
          </div>

          {/* Active toggle */}
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
            <button
              onClick={() => setIsActive((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-4"
            >
              <div className="flex items-center gap-3">
                {isActive ? (
                  <Eye size={18} className="text-emerald-400" />
                ) : (
                  <EyeOff size={18} className="text-zinc-500" />
                )}
                <div className="text-left">
                  <p className="text-[14px] font-medium text-white">
                    {isActive ? "Subscription is active" : "Subscription is hidden"}
                  </p>
                  <p className="text-[12px] text-zinc-500">
                    {isActive ? "Clients can subscribe from your profile" : "Toggle on to allow subscriptions"}
                  </p>
                </div>
              </div>
              <div className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                isActive ? "bg-emerald-500" : "bg-zinc-700"
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
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-[15px] font-semibold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : tier?.id ? "Update Tier" : "Create Tier"}
          </button>

          <p className="text-center text-[12px] text-zinc-600">
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
              toast.ok ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
