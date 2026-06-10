"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Mail, Lock, Trash2, Loader2, Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-300">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-300">{label}</p>
      {children}
    </div>
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const { t } = useTranslation();

  const [currentEmail, setCurrentEmail] = useState("");

  // Email form
  const [newEmail, setNewEmail]         = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  // Password form
  const [newPw, setNewPw]               = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [showNew, setShowNew]           = useState(false);
  const [pwLoading, setPwLoading]       = useState(false);
  const [pwMsg, setPwMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  // Delete account
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    setCurrentEmail(user.email ?? "");
  }, [user, checked, router]);

  async function handleEmailChange(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setEmailLoading(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setEmailLoading(false);
    if (error) {
      setEmailMsg({ text: error.message, ok: false });
    } else {
      setEmailMsg({ text: t("settings_email_sent"), ok: true });
      setNewEmail("");
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setPwMsg({ text: "Passwords don't match.", ok: false });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ text: "Password must be at least 8 characters.", ok: false });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) {
      setPwMsg({ text: error.message, ok: false });
    } else {
      setPwMsg({ text: "Password updated successfully.", ok: true });
      setNewPw(""); setConfirmPw("");
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleteLoading(true);
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-700"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("settings_title")}</span>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        {/* Email */}
        <Section title={t("settings_email")}>
          <Field label={t("settings_current_email")}>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <Mail size={15} className="text-slate-400" />
              <span className="text-[14px] text-slate-600">{currentEmail || "—"}</span>
            </div>
          </Field>
          <form onSubmit={handleEmailChange} className="px-4 pb-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-300">{t("settings_new_email")}</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={t("settings_new_email_ph")}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-300 outline-none focus:border-pink-300"
            />
            {emailMsg && (
              <p className={cn("mt-2 text-[12px]", emailMsg.ok ? "text-emerald-400" : "text-red-500")}>
                {emailMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={emailLoading || !newEmail.trim()}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition",
                newEmail.trim() && !emailLoading
                  ? "bg-pink-400 text-white hover:bg-pink-300"
                  : "bg-gray-100 text-slate-400 cursor-not-allowed"
              )}
            >
              {emailLoading && <Loader2 size={14} className="animate-spin" />}
              {t("settings_update_email")}
            </button>
          </form>
        </Section>

        {/* Password */}
        <Section title={t("settings_password")}>
          <form onSubmit={handlePasswordChange} className="px-4 py-4 space-y-3">
            {[
              { label: t("settings_new_password"), value: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew((s) => !s) },
              { label: t("settings_confirm_pw"), value: confirmPw, set: setConfirmPw, show: showNew, toggle: () => {} },
            ].map(({ label, value, set, show, toggle }) => (
              <div key={label}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-slate-300">{label}</p>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <Lock size={15} className="text-slate-400 flex-shrink-0" />
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder-slate-300 outline-none"
                  />
                  {label === t("settings_new_password") && (
                    <button type="button" onClick={toggle} className="text-slate-400 hover:text-slate-600">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pwMsg && (
              <p className={cn("text-[12px]", pwMsg.ok ? "text-emerald-400" : "text-red-500")}>
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={pwLoading || !newPw || !confirmPw}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition",
                newPw && confirmPw && !pwLoading
                  ? "bg-pink-400 text-white hover:bg-pink-300"
                  : "bg-gray-100 text-slate-400 cursor-not-allowed"
              )}
            >
              {pwLoading && <Loader2 size={14} className="animate-spin" />}
              {t("settings_change_pw")}
            </button>
          </form>
        </Section>

        {/* Danger zone */}
        <Section title={t("settings_danger")}>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-4 transition hover:bg-red-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500">
              <Trash2 size={18} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-medium text-red-500">{t("settings_delete")}</p>
              <p className="text-[12px] text-slate-400">{t("settings_delete_sub")}</p>
            </div>
          </button>
        </Section>
      </div>

      {/* Delete modal */}
      <AnimatePresence>
        {deleteOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setDeleteOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
                <AlertTriangle size={24} className="text-red-500" />
              </div>
              <h2 className="text-[17px] font-semibold text-slate-800">{t("settings_delete_confirm")}</h2>
              <p className="mt-1 text-[13px] text-slate-500">{t("settings_delete_body")}</p>
              <p className="mt-4 text-[12px] text-slate-400">{t("settings_type_delete")}</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-[14px] text-slate-800 placeholder-slate-300 outline-none focus:border-red-300"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                  className="flex-1 rounded-xl border border-gray-200 py-3 text-[14px] font-medium text-slate-600 transition hover:bg-gray-100"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "DELETE" || deleteLoading}
                  className={cn(
                    "flex-1 rounded-xl py-3 text-[14px] font-semibold transition",
                    deleteConfirm === "DELETE"
                      ? "bg-red-500 text-white hover:bg-red-400"
                      : "bg-gray-100 text-slate-400 cursor-not-allowed"
                  )}
                >
                  {deleteLoading ? <Loader2 size={14} className="mx-auto animate-spin" /> : t("delete")}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
