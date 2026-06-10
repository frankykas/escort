"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

type State = "idle" | "loading" | "done";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("auth_err_pw_mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth_err_pw_short"));
      return;
    }

    setState("loading");

    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(updateErr.message);
      setState("idle");
      return;
    }

    setState("done");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafbfc] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <p className="mb-8 text-center text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-400 to-sky-400 bg-clip-text text-transparent">
          Cleopatra
        </p>

        {state === "done" ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pink-50">
              <CheckCircle size={24} className="text-pink-400" />
            </div>
            <h2 className="text-base font-semibold text-slate-800">{t("auth_pw_updated")}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {t("auth_pw_updated_body")}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-[rgb(246,51,154)] py-3 text-sm font-semibold text-white transition hover:brightness-105"
            >
              {t("auth_continue")}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="mb-1 text-base font-semibold text-slate-800">{t("auth_reset_title")}</h1>
            <p className="mb-6 text-xs text-slate-400">
              {t("auth_reset_subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {t("auth_new_password")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={t("auth_password_ph_min")}
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {t("auth_confirm_password")}
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={t("auth_password_ph_repeat")}
                  className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
                />
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}

              <button
                type="submit"
                disabled={state === "loading"}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(246,51,154)] py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("auth_updating")}
                  </>
                ) : (
                  t("auth_update_pw")
                )}
              </button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
}
