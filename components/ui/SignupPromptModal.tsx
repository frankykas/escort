"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

export type PromptAction =
  | "message"
  | "like"
  | "follow"
  | "favorite"
  | "comment"
  | "subscribe";

type Props = {
  open: boolean;
  onClose: () => void;
  action: PromptAction;
  redirectPath?: string;
};

const BODY_KEYS: Record<PromptAction, TranslationKey> = {
  message:   "signup_prompt_body_message",
  like:      "signup_prompt_body_like",
  follow:    "signup_prompt_body_follow",
  favorite:  "signup_prompt_body_favorite",
  comment:   "signup_prompt_body_comment",
  subscribe: "signup_prompt_body_subscribe",
};

export function SignupPromptModal({ open, onClose, action, redirectPath }: Props) {
  const { t } = useTranslation();
  const next = redirectPath ? `?next=${encodeURIComponent(redirectPath)}` : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="signup-prompt-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            key="signup-prompt-card"
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_12px_48px_rgba(0,0,0,0.12)]"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-gray-100 hover:text-slate-700"
            >
              <X size={14} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 border border-pink-200">
                <UserPlus size={28} className="text-pink-500" />
              </div>

              <h3 className="mt-4 text-[18px] font-bold text-slate-800">
                {t("signup_prompt_title")}
              </h3>

              <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
                {t(BODY_KEYS[action])}
              </p>

              <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
                <ShieldCheck size={16} className="flex-shrink-0 text-emerald-500" />
                <p className="text-[12px] leading-snug text-emerald-600 text-left">
                  {t("signup_prompt_reassure")}
                </p>
              </div>

              <Link
                href={`/auth/signup${next}`}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-pink-400 py-3 text-[15px] font-bold text-white transition hover:bg-pink-300 active:scale-[0.98] shadow-[0_0_24px_rgba(236,72,153,0.25)]"
              >
                <UserPlus size={16} />
                {t("signup_prompt_cta")}
              </Link>

              <p className="mt-3 text-[13px] text-slate-400">
                {t("signup_prompt_signin_pre")}{" "}
                <Link
                  href={`/auth/signin${next}`}
                  className="font-medium text-pink-500 hover:text-pink-400 transition"
                >
                  {t("signup_prompt_signin_link")}
                </Link>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
