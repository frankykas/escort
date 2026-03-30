"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Phone, Send, X, ChevronRight, ChevronLeft,
  Calendar, Clock, MapPin, CheckCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { USE_BOOKINGS } from "@/lib/features";

type Props = {
  username: string;
  providerId: string;
  isOwnProfile: boolean;
};

type Step = "options" | "form" | "sent";

type FormState = {
  date: string;
  time: string;
  duration: string;
  callType: "incall" | "outcall" | "";
  area: string;
  message: string;
};

const EMPTY_FORM: FormState = {
  date: "", time: "", duration: "", callType: "", area: "", message: "",
};

const TIME_OPTIONS = [
  { value: "morning",      label: "Morning",      sub: "9am – 12pm" },
  { value: "afternoon",    label: "Afternoon",    sub: "12pm – 5pm" },
  { value: "evening",      label: "Evening",      sub: "5pm – 9pm" },
  { value: "late-evening", label: "Late evening", sub: "9pm – 12am" },
  { value: "flexible",     label: "Flexible",     sub: "Any time" },
];

const DURATION_OPTIONS = [
  { value: "30",  label: "30 min" },
  { value: "60",  label: "1 hour" },
  { value: "90",  label: "90 min" },
  { value: "120", label: "2 hours" },
  { value: "240", label: "4 hours" },
  { value: "720", label: "Overnight" },
];

const inputCls =
  "w-full rounded-xl border border-white/8 bg-zinc-900 px-4 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/40 focus:ring-1 focus:ring-amber-400/20";

function FormField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
        <Icon size={10} />
        {label}
      </label>
      {children}
    </div>
  );
}

export function EnquireBar({ username, providerId, isOwnProfile }: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<Step>("options");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Bookings feature is disabled — don't render the enquiry bar
  if (!USE_BOOKINGS) return null;
  if (isOwnProfile) return null;

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => { setStep("options"); setForm(EMPTY_FORM); setSubmitError(null); }, 350);
  }

  function patch(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const formValid = form.date.length > 0 && form.callType !== "";

  async function handleSubmit() {
    if (!user) { router.push("/auth/signin"); return; }
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await supabase.from("bookings").insert({
      client_id:        user.id,
      provider_id:      providerId,
      listing_id:       null,
      requested_date:   form.date,
      requested_time:   form.time || null,
      duration_minutes: form.duration ? parseInt(form.duration, 10) : null,
      service_type:     form.callType || null,
      area:             form.callType === "outcall" ? (form.area || null) : null,
      notes:            form.message.trim() || null,
    });
    setSubmitting(false);
    if (error) { setSubmitError("Failed to send enquiry. Please try again."); return; }
    setStep("sent");
  }

  return (
    <>
      {/* ── Sticky bar ── */}
      <div className="fixed inset-x-0 bottom-[57px] z-30 border-t border-white/5 bg-zinc-950/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3">

          <button
            aria-label="WhatsApp"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
          >
            <Phone size={19} strokeWidth={2} />
          </button>

          <button
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_28px_rgba(251,191,36,0.4)] transition-all hover:bg-amber-300 active:scale-[0.98]"
          >
            <MessageCircle size={17} strokeWidth={2.5} />
            Enquire Now
          </button>

          <button
            aria-label="Telegram"
            className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-400 transition-all hover:bg-sky-500/20 active:scale-95"
          >
            <Send size={17} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* ── Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={closeSheet}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950 px-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-700" />
              </div>

              <div className="flex items-center gap-3 py-4 border-b border-white/5">
                {step === "form" && (
                  <button
                    onClick={() => setStep("options")}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                <div className="flex-1">
                  {step === "options" && (
                    <>
                      <p className="text-[16px] font-semibold text-white">Get in touch</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">Contact @{username}</p>
                    </>
                  )}
                  {step === "form" && (
                    <>
                      <p className="text-[16px] font-semibold text-white">Send an enquiry</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">to @{username}</p>
                    </>
                  )}
                  {step === "sent" && (
                    <p className="text-[16px] font-semibold text-white">Enquiry sent!</p>
                  )}
                </div>
                <button
                  onClick={closeSheet}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                >
                  <X size={14} />
                </button>
              </div>

              <AnimatePresence mode="wait">

                {/* ── Contact options ── */}
                {step === "options" && (
                  <motion.div
                    key="options"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.16 }}
                    className="space-y-2.5 py-4"
                  >
                    {[
                      {
                        icon: Phone,
                        label: "WhatsApp",
                        sub: "Chat directly on WhatsApp",
                        color: "text-emerald-400",
                        iconBg: "bg-emerald-500/15",
                        border: "border-emerald-500/15",
                        action: () => {},
                      },
                      {
                        icon: Send,
                        label: "Telegram",
                        sub: "Message on Telegram",
                        color: "text-sky-400",
                        iconBg: "bg-sky-500/15",
                        border: "border-sky-500/15",
                        action: () => {},
                      },
                      {
                        icon: MessageCircle,
                        label: "Send an enquiry",
                        sub: "Fill in your details for a structured request",
                        color: "text-amber-400",
                        iconBg: "bg-amber-400/15",
                        border: "border-amber-400/20",
                        action: () => setStep("form"),
                      },
                    ].map(({ icon: Icon, label, sub, color, iconBg, border, action }) => (
                      <button
                        key={label}
                        onClick={action}
                        className={`flex w-full items-center gap-4 rounded-2xl border ${border} bg-zinc-900/60 px-4 py-4 text-left transition-all active:scale-[0.99] hover:opacity-90`}
                      >
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
                  </motion.div>
                )}

                {/* ── Enquiry form ── */}
                {step === "form" && (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.16 }}
                    className="py-4"
                  >
                    <div className="max-h-[55vh] space-y-4 overflow-y-auto pb-2">

                      {/* Date + time */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormField icon={Calendar} label="Preferred date *">
                          <input
                            type="date"
                            min={minDate}
                            value={form.date}
                            onChange={(e) => patch("date", e.target.value)}
                            className={inputCls}
                          />
                        </FormField>
                        <FormField icon={Clock} label="Preferred time">
                          <select
                            value={form.time}
                            onChange={(e) => patch("time", e.target.value)}
                            className={inputCls}
                          >
                            <option value="">Any time</option>
                            {TIME_OPTIONS.map((t) => (
                              <option key={t.value} value={t.value}>{t.label} ({t.sub})</option>
                            ))}
                          </select>
                        </FormField>
                      </div>

                      {/* Duration */}
                      <FormField icon={Clock} label="Duration">
                        <div className="flex flex-wrap gap-2">
                          {DURATION_OPTIONS.map((d) => (
                            <button
                              key={d.value}
                              onClick={() => patch("duration", form.duration === d.value ? "" : d.value)}
                              className={cn(
                                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
                                form.duration === d.value
                                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                                  : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                              )}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </FormField>

                      {/* In-call / Out-call */}
                      <FormField icon={MapPin} label="Preference *">
                        <div className="grid grid-cols-2 gap-2">
                          {(["incall", "outcall"] as const).map((type) => (
                            <button
                              key={type}
                              onClick={() => patch("callType", type)}
                              className={cn(
                                "rounded-xl border py-3 text-[13px] font-medium capitalize transition-all",
                                form.callType === type
                                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                                  : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                              )}
                            >
                              {type === "incall" ? "In-call" : "Out-call"}
                            </button>
                          ))}
                        </div>
                      </FormField>

                      {form.callType === "outcall" && (
                        <FormField icon={MapPin} label="Your area / neighbourhood">
                          <input
                            type="text"
                            placeholder="e.g. Downtown, Midtown…"
                            value={form.area}
                            onChange={(e) => patch("area", e.target.value)}
                            maxLength={80}
                            className={inputCls}
                          />
                        </FormField>
                      )}

                      {/* Message */}
                      <FormField icon={MessageCircle} label="Message">
                        <textarea
                          placeholder="Introduce yourself and share any details or questions…"
                          value={form.message}
                          onChange={(e) => patch("message", e.target.value)}
                          maxLength={400}
                          rows={3}
                          className={`${inputCls} resize-none`}
                        />
                        <p className="mt-1 text-right text-[10px] text-zinc-600">{form.message.length}/400</p>
                      </FormField>

                    </div>

                    {submitError && (
                      <p className="mt-2 text-[12px] text-red-400">{submitError}</p>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={!formValid || submitting}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-40"
                    >
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" /> Sending…</>
                        : <><Send size={15} strokeWidth={2.5} /> Send enquiry</>
                      }
                    </button>
                  </motion.div>
                )}

                {/* ── Sent confirmation ── */}
                {step === "sent" && (
                  <motion.div
                    key="sent"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col items-center gap-4 py-10 text-center"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/10">
                      <CheckCircle size={32} className="text-amber-400" />
                    </div>
                    <div>
                      <p className="text-[17px] font-semibold text-white">Enquiry sent!</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                        @{username} will get back to you shortly.{"\n"}Check your bookings for updates.
                      </p>
                    </div>
                    <button
                      onClick={closeSheet}
                      className="mt-2 rounded-full border border-white/10 px-6 py-2.5 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white"
                    >
                      Close
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
