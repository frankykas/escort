"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Zap, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type Day = typeof DAYS[number];

const SLOTS = ["Morning", "Afternoon", "Evening", "Late night"] as const;
type Slot = typeof SLOTS[number];

type Schedule = Partial<Record<Day, Slot[]>>;

type Availability = {
  available_now: boolean;
  schedule: Schedule;
};

const DEFAULT: Availability = { available_now: false, schedule: {} };

export default function AvailabilityPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [avail, setAvail]   = useState<Availability>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    supabase
      .from("profiles")
      .select("availability")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.availability) setAvail(data.availability as Availability);
        setLoaded(true);
      });
  }, [user, checked]);

  function toggleSlot(day: Day, slot: Slot) {
    setAvail((prev) => {
      const current = prev.schedule[day] ?? [];
      const next = current.includes(slot)
        ? current.filter((s) => s !== slot)
        : [...current, slot];
      const schedule = { ...prev.schedule };
      if (next.length === 0) delete schedule[day];
      else schedule[day] = next;
      return { ...prev, schedule };
    });
  }

  function toggleDay(day: Day) {
    setAvail((prev) => {
      const schedule = { ...prev.schedule };
      if (schedule[day]?.length) delete schedule[day];
      else schedule[day] = ["Morning", "Afternoon", "Evening"] as Slot[];
      return { ...prev, schedule };
    });
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ availability: avail })
      .eq("id", user.id);
    setSaving(false);
    showToast(error ? "Failed to save" : "Availability saved", !error);
  }

  async function toggleAvailableNow(v: boolean) {
    const next = { ...avail, available_now: v };
    setAvail(next);
    if (!user) return;
    await supabase.from("profiles").update({ availability: next }).eq("id", user.id);
  }

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  const activeDaysCount = Object.values(avail.schedule).filter((s) => s && s.length > 0).length;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Availability</span>
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
          {/* Available Now */}
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
            <button
              onClick={() => toggleAvailableNow(!avail.available_now)}
              className="flex w-full items-center gap-4 px-4 py-4"
            >
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition",
                avail.available_now ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"
              )}>
                <Zap size={20} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[15px] font-semibold text-white">Available Now</p>
                <p className="text-[12px] text-zinc-500">
                  {avail.available_now ? "You appear as available to clients right now" : "Toggle on to show you're available immediately"}
                </p>
              </div>
              <div className={cn(
                "relative h-6 w-11 rounded-full transition-colors",
                avail.available_now ? "bg-emerald-500" : "bg-zinc-700"
              )}>
                <div className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all",
                  avail.available_now ? "left-[22px]" : "left-0.5"
                )} />
              </div>
            </button>
          </div>

          {/* Weekly schedule */}
          <div>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600">Weekly Schedule</p>
              {activeDaysCount > 0 && (
                <p className="text-[12px] text-amber-400">{activeDaysCount} day{activeDaysCount !== 1 ? "s" : ""} active</p>
              )}
            </div>

            <div className="space-y-2">
              {DAYS.map((day) => {
                const daySlots = avail.schedule[day] ?? [];
                const dayActive = daySlots.length > 0;

                return (
                  <div
                    key={day}
                    className={cn(
                      "overflow-hidden rounded-2xl border transition",
                      dayActive ? "border-amber-400/20 bg-zinc-900" : "border-white/5 bg-zinc-900/50"
                    )}
                  >
                    <button
                      onClick={() => toggleDay(day)}
                      className="flex w-full items-center justify-between px-4 py-3"
                    >
                      <span className={cn(
                        "text-[14px] font-semibold w-12 text-left",
                        dayActive ? "text-white" : "text-zinc-500"
                      )}>
                        {day}
                      </span>
                      <div className="flex flex-1 flex-wrap gap-1.5 justify-end pr-2">
                        {dayActive && daySlots.map((s) => (
                          <span key={s} className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-400">
                            {s}
                          </span>
                        ))}
                        {!dayActive && (
                          <span className="text-[12px] text-zinc-600">Off</span>
                        )}
                      </div>
                      <div className={cn(
                        "relative h-5 w-9 rounded-full transition-colors flex-shrink-0",
                        dayActive ? "bg-amber-400" : "bg-zinc-700"
                      )}>
                        <div className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                          dayActive ? "left-[18px]" : "left-0.5"
                        )} />
                      </div>
                    </button>

                    <AnimatePresence>
                      {dayActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-t border-white/5"
                        >
                          <div className="flex gap-2 px-4 py-3 flex-wrap">
                            {SLOTS.map((slot) => {
                              const on = daySlots.includes(slot);
                              return (
                                <button
                                  key={slot}
                                  onClick={() => toggleSlot(day, slot)}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-[12px] font-medium transition",
                                    on
                                      ? "border-amber-400 bg-amber-400/10 text-amber-400"
                                      : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                                  )}
                                >
                                  {slot}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="px-1 text-[12px] text-zinc-600">
            Your schedule is shown on your public profile so clients know when to reach out.
          </p>

          {/* Bottom save */}
          <button
            onClick={save}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-4 text-[15px] font-semibold text-zinc-950 transition hover:bg-amber-300 active:scale-[0.98] disabled:opacity-50"
          >
            {saving && <Loader2 size={18} className="animate-spin" />}
            {saving ? "Saving…" : "Save Availability"}
          </button>
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
