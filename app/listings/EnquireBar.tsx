"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, Phone, Send, X, ChevronRight } from "lucide-react";

type Props = {
  username: string;
  rate: number | null;
  duration: number | null;
};

function formatRate(pence: number | null) {
  if (!pence) return "POA";
  return `CA$${Math.round(pence / 100).toLocaleString()}`;
}

function formatDuration(minutes: number | null) {
  if (!minutes) return null;
  if (minutes === 720) return "Overnight";
  if (minutes >= 1440) return `${minutes / 1440}d`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}hr`;
}

export function EnquireBar({ username, rate, duration }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      {/* ── Bar ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-zinc-950/95 px-4 backdrop-blur-xl"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", paddingTop: "12px" }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-4">
          {/* Rate display */}
          <div className="flex flex-col">
            <span className="text-[22px] font-bold leading-none text-amber-400">
              {formatRate(rate)}
            </span>
            {duration && (
              <span className="mt-0.5 text-[10px] text-zinc-500">{formatDuration(duration)}</span>
            )}
          </div>

          {/* Spacer */}
          <div className="flex flex-1 items-center gap-2">
            {/* WhatsApp */}
            <button
              aria-label="WhatsApp"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
            >
              <Phone size={18} strokeWidth={2} />
            </button>

            {/* Main CTA */}
            <button
              onClick={() => setSheetOpen(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_28px_rgba(251,191,36,0.4)] transition-all hover:bg-amber-300 active:scale-[0.98]"
            >
              <MessageCircle size={17} strokeWidth={2.5} />
              Enquire Now
            </button>
          </div>
        </div>
      </div>

      {/* ── Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950 px-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-700" />
              </div>
              <div className="flex items-center justify-between py-4 border-b border-white/5">
                <div>
                  <p className="text-[16px] font-semibold text-white">Get in touch</p>
                  <p className="mt-0.5 text-[12px] text-zinc-500">Contact @{username}</p>
                </div>
                <button onClick={() => setSheetOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2.5 py-4">
                {[
                  { icon: Phone, label: "WhatsApp", sub: "Chat directly on WhatsApp", color: "text-emerald-400", iconBg: "bg-emerald-500/15", border: "border-emerald-500/15" },
                  { icon: Send, label: "Telegram", sub: "Message on Telegram", color: "text-sky-400", iconBg: "bg-sky-500/15", border: "border-sky-500/15" },
                  { icon: MessageCircle, label: "Send a message", sub: "Message within Cleopatra", color: "text-amber-400", iconBg: "bg-amber-400/15", border: "border-amber-400/15" },
                ].map(({ icon: Icon, label, sub, color, iconBg, border }) => (
                  <button key={label} className={`flex w-full items-center gap-4 rounded-2xl border ${border} bg-zinc-900/60 px-4 py-4 text-left transition-all active:scale-[0.99]`}>
                    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} ${color}`}>
                      <Icon size={19} strokeWidth={1.8} />
                    </div>
                    <div className="flex-1">
                      <p className={`text-[14px] font-semibold ${color}`}>{label}</p>
                      <p className="text-[12px] text-zinc-500">{sub}</p>
                    </div>
                    <ChevronRight size={15} className="flex-shrink-0 text-zinc-600" />
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
