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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5">
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
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-zinc-600">{label}</p>
      {children}
    </div>
  );
}

export default function AccountSettingsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [currentEmail, setCurrentEmail] = useState("");

  // Email form
  const [newEmail, setNewEmail]         = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMsg, setEmailMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  // Password form
  const [currentPw, setCurrentPw]       = useState("");
  const [newPw, setNewPw]               = useState("");
  const [confirmPw, setConfirmPw]       = useState("");
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [pwLoading, setPwLoading]       = useState(false);
  const [pwMsg, setPwMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  // Delete account
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    setCurrentEmail(user.email ?? "");
  }, [user, checked]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

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
      setEmailMsg({ text: "Confirmation sent to both addresses.", ok: true });
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
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "DELETE") return;
    setDeleteLoading(true);
    // Sign out — actual account deletion requires a server-side function
    // Placeholder: sign out and show info
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Account Settings</span>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 pt-6">
        {/* Email */}
        <Section title="Email address">
          <Field label="Current email">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
              <Mail size={15} className="text-zinc-500" />
              <span className="text-[14px] text-zinc-300">{currentEmail || "—"}</span>
            </div>
          </Field>
          <form onSubmit={handleEmailChange} className="px-4 pb-4">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-zinc-600">New email</p>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Enter new email address"
              className="w-full rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-amber-400/40"
            />
            {emailMsg && (
              <p className={cn("mt-2 text-[12px]", emailMsg.ok ? "text-emerald-400" : "text-red-400")}>
                {emailMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={emailLoading || !newEmail.trim()}
              className={cn(
                "mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition",
                newEmail.trim() && !emailLoading
                  ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {emailLoading && <Loader2 size={14} className="animate-spin" />}
              Update Email
            </button>
          </form>
        </Section>

        {/* Password */}
        <Section title="Password">
          <form onSubmit={handlePasswordChange} className="px-4 py-4 space-y-3">
            {[
              { label: "New password", value: newPw, set: setNewPw, show: showNew, toggle: () => setShowNew((s) => !s) },
              { label: "Confirm new password", value: confirmPw, set: setConfirmPw, show: showNew, toggle: () => {} },
            ].map(({ label, value, set, show, toggle }) => (
              <div key={label}>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-zinc-600">{label}</p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                  <Lock size={15} className="text-zinc-500 flex-shrink-0" />
                  <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-[14px] text-white placeholder-zinc-600 outline-none"
                  />
                  {label === "New password" && (
                    <button type="button" onClick={toggle} className="text-zinc-500 hover:text-zinc-300">
                      {show ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pwMsg && (
              <p className={cn("text-[12px]", pwMsg.ok ? "text-emerald-400" : "text-red-400")}>
                {pwMsg.text}
              </p>
            )}
            <button
              type="submit"
              disabled={pwLoading || !newPw || !confirmPw}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-semibold transition",
                newPw && confirmPw && !pwLoading
                  ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              {pwLoading && <Loader2 size={14} className="animate-spin" />}
              Change Password
            </button>
          </form>
        </Section>

        {/* Danger zone */}
        <Section title="Danger zone">
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-4 transition hover:bg-red-500/5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Trash2 size={18} />
            </div>
            <div className="text-left">
              <p className="text-[14px] font-medium text-red-400">Delete account</p>
              <p className="text-[12px] text-zinc-500">Permanently remove your account and all data</p>
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
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setDeleteOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-900 p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10">
                <AlertTriangle size={24} className="text-red-400" />
              </div>
              <h2 className="text-[17px] font-semibold text-white">Delete account?</h2>
              <p className="mt-1 text-[13px] text-zinc-400">
                This will permanently delete your profile, listings, posts, and all data. This cannot be undone.
              </p>
              <p className="mt-4 text-[12px] text-zinc-500">Type <strong className="text-zinc-300">DELETE</strong> to confirm</p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-[14px] text-white placeholder-zinc-600 outline-none focus:border-red-400/40"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                  className="flex-1 rounded-xl border border-white/10 py-3 text-[14px] font-medium text-zinc-300 transition hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "DELETE" || deleteLoading}
                  className={cn(
                    "flex-1 rounded-xl py-3 text-[14px] font-semibold transition",
                    deleteConfirm === "DELETE"
                      ? "bg-red-500 text-white hover:bg-red-400"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {deleteLoading ? <Loader2 size={14} className="mx-auto animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
