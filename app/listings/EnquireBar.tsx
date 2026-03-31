"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, X, ChevronRight,
  CheckCircle, Loader2, ExternalLink, Tag, Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

// ─── WhatsApp / Telegram brand icons ────────────────────────────────────────

function WhatsAppIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function TelegramIcon({ size = 19 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Props = {
  username: string;
  providerId: string;
  listingId?: string | null;
  listingTitle?: string | null;
  rate: number | null;
  duration: number | null;
  contactWhatsapp?: string | null;
  contactTelegram?: string | null;
  contactPhone?: string | null;
};

type Step = "options" | "compose" | "sent";

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

// ─── Component ──────────────────────────────────────────────────────────────

export function EnquireBar({
  username, providerId, listingId, listingTitle,
  rate, duration,
  contactWhatsapp, contactTelegram, contactPhone,
}: Props) {
  const router = useRouter();
  const { user } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<Step>("options");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasWhatsapp = !!contactWhatsapp;
  const hasTelegram = !!contactTelegram;
  const hasPhone = !!contactPhone;
  const hasExternalContact = hasWhatsapp || hasTelegram || hasPhone;

  function closeSheet() {
    setSheetOpen(false);
    setTimeout(() => { setStep("options"); setMessage(""); setSubmitError(null); }, 350);
  }

  function handleMainCta() {
    if (!user) { router.push("/auth/signin"); return; }
    if (!hasExternalContact) {
      setStep("compose");
      setSheetOpen(true);
    } else {
      setStep("options");
      setSheetOpen(true);
    }
  }

  async function handleSend() {
    if (!user) { router.push("/auth/signin"); return; }
    if (!message.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    // Prepend listing context to the message body
    const listingContext = listingTitle
      ? `[Re: ${listingTitle}]\n\n`
      : "";

    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      recipient_id: providerId,
      body: listingContext + message.trim(),
      listing_id: listingId ?? null,
    });

    setSubmitting(false);
    if (error) {
      setSubmitError("Failed to send message. Please try again.");
      return;
    }
    setStep("sent");
  }

  function openWhatsapp() {
    if (!contactWhatsapp) return;
    const clean = contactWhatsapp.replace(/\D/g, "");
    const text = listingTitle
      ? `Hi, I'm interested in your listing: ${listingTitle}`
      : `Hi ${username}, I found you on Cleopatra`;
    window.open(`https://wa.me/${clean}?text=${encodeURIComponent(text)}`, "_blank");
  }

  function openTelegram() {
    if (!contactTelegram) return;
    const handle = contactTelegram.replace(/^@/, "");
    window.open(`https://t.me/${handle}`, "_blank");
  }

  function openPhone() {
    if (!contactPhone) return;
    const clean = contactPhone.replace(/\D/g, "");
    window.open(`tel:+${clean}`, "_self");
  }

  const contactOptions = [
    ...(hasWhatsapp ? [{
      icon: WhatsAppIcon,
      label: "WhatsApp",
      sub: "Chat on WhatsApp",
      color: "text-emerald-400",
      iconBg: "bg-emerald-500/15",
      border: "border-emerald-500/15",
      action: openWhatsapp,
      external: true,
    }] : []),
    ...(hasTelegram ? [{
      icon: TelegramIcon,
      label: "Telegram",
      sub: "Message on Telegram",
      color: "text-sky-400",
      iconBg: "bg-sky-500/15",
      border: "border-sky-500/15",
      action: openTelegram,
      external: true,
    }] : []),
    ...(hasPhone ? [{
      icon: Phone,
      label: "Call",
      sub: contactPhone!,
      color: "text-violet-400",
      iconBg: "bg-violet-500/15",
      border: "border-violet-500/15",
      action: openPhone,
      external: true,
    }] : []),
    {
      icon: MessageCircle,
      label: "Send a Message",
      sub: "Private in-app message to @" + username,
      color: "text-amber-400",
      iconBg: "bg-amber-400/15",
      border: "border-amber-400/20",
      action: () => {
        if (!user) { router.push("/auth/signin"); return; }
        setStep("compose");
      },
      external: false,
    },
  ];

  return (
    <>
      {/* ── Sticky bar ── */}
      <div
        className="fixed inset-x-0 bottom-[57px] z-30 border-t border-white/5 bg-zinc-950/95 px-4 backdrop-blur-xl"
        style={{ paddingBottom: "12px", paddingTop: "12px" }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[22px] font-bold leading-none text-amber-400">{formatRate(rate)}</span>
            {duration && <span className="mt-0.5 text-[10px] text-zinc-500">{formatDuration(duration)}</span>}
          </div>
          <div className="flex flex-1 items-center gap-2">
            {hasWhatsapp && (
              <button
                onClick={openWhatsapp}
                aria-label="WhatsApp"
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 transition-all hover:bg-emerald-500/20 active:scale-95"
              >
                <WhatsAppIcon size={18} />
              </button>
            )}
            <button
              onClick={handleMainCta}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_28px_rgba(251,191,36,0.4)] transition-all hover:bg-amber-300 active:scale-[0.98]"
            >
              <MessageCircle size={17} strokeWidth={2.5} />
              Message
            </button>
            {hasTelegram && (
              <button
                onClick={openTelegram}
                aria-label="Telegram"
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-400 transition-all hover:bg-sky-500/20 active:scale-95"
              >
                <TelegramIcon size={18} />
              </button>
            )}
            {hasPhone && (
              <button
                onClick={openPhone}
                aria-label="Call"
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-400 transition-all hover:bg-violet-500/20 active:scale-95"
              >
                <Phone size={18} strokeWidth={2} />
              </button>
            )}
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
              onClick={closeSheet}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950 px-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="h-1 w-10 rounded-full bg-zinc-700" />
              </div>

              {/* Header */}
              <div className="flex items-center gap-3 py-4 border-b border-white/5">
                {step === "compose" && hasExternalContact && (
                  <button
                    onClick={() => setStep("options")}
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  >
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                )}
                <div className="flex-1">
                  {step === "options" && (
                    <>
                      <p className="text-[16px] font-semibold text-white">Contact</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">Reach out to @{username}</p>
                    </>
                  )}
                  {step === "compose" && (
                    <>
                      <p className="text-[16px] font-semibold text-white">New Message</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500">to @{username}</p>
                    </>
                  )}
                  {step === "sent" && (
                    <p className="text-[16px] font-semibold text-white">Message sent!</p>
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
                    {contactOptions.map(({ icon: Icon, label, sub, color, iconBg, border, action, external }) => (
                      <button
                        key={label}
                        onClick={action}
                        className={`flex w-full items-center gap-4 rounded-2xl border ${border} bg-zinc-900/60 px-4 py-4 text-left transition-all active:scale-[0.99] hover:opacity-90`}
                      >
                        <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} ${color}`}>
                          <Icon size={19} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-[14px] font-semibold ${color}`}>{label}</p>
                          <p className="text-[12px] text-zinc-500">{sub}</p>
                        </div>
                        {external
                          ? <ExternalLink size={14} className="flex-shrink-0 text-zinc-600" />
                          : <ChevronRight size={15} className="flex-shrink-0 text-zinc-600" />
                        }
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* ── Message compose ── */}
                {step === "compose" && (
                  <motion.div
                    key="compose"
                    initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.16 }}
                    className="py-4"
                  >
                    {/* Listing context badge */}
                    {listingTitle && (
                      <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/10 bg-amber-400/5 px-3 py-2">
                        <Tag size={12} className="flex-shrink-0 text-amber-400/60" />
                        <p className="text-[11px] text-zinc-400 truncate">
                          Re: <span className="text-zinc-300">{listingTitle}</span>
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/5 bg-zinc-900/50 p-1">
                      <textarea
                        autoFocus
                        placeholder={`Hi ${username}, I'm interested in your services...`}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        maxLength={500}
                        rows={4}
                        className="w-full resize-none rounded-xl bg-transparent px-3 py-3 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none"
                      />
                      <div className="flex items-center justify-between px-3 pb-2">
                        <p className="text-[10px] text-zinc-600">{message.length}/500</p>
                        <p className="text-[10px] text-zinc-600">Private &amp; secure</p>
                      </div>
                    </div>

                    {submitError && (
                      <p className="mt-2 text-[12px] text-red-400">{submitError}</p>
                    )}

                    <button
                      onClick={handleSend}
                      disabled={!message.trim() || submitting}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 text-[14px] font-bold text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all hover:bg-amber-300 active:scale-[0.99] disabled:opacity-40"
                    >
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" /> Sending&hellip;</>
                        : <><Send size={15} strokeWidth={2.5} /> Send Message</>
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
                      <p className="text-[17px] font-semibold text-white">Message sent!</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
                        @{username} will see your message in their inbox.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => router.push(`/messages/${username}`)}
                        className="rounded-full bg-amber-400/10 px-5 py-2.5 text-[13px] font-medium text-amber-400 transition-all hover:bg-amber-400/20"
                      >
                        View Conversation
                      </button>
                      <button
                        onClick={closeSheet}
                        className="rounded-full border border-white/10 px-5 py-2.5 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:text-white"
                      >
                        Close
                      </button>
                    </div>
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
