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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <p className="mb-8 text-center text-2xl font-bold tracking-tight text-amber-400">
          Cleopatra
        </p>

        {state === "done" ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10">
              <CheckCircle size={24} className="text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">{t("auth_pw_updated")}</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t("auth_pw_updated_body")}
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              {t("auth_continue")}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-xl">
            <h1 className="mb-1 text-base font-semibold text-zinc-100">{t("auth_reset_title")}</h1>
            <p className="mb-6 text-xs text-zinc-500">
              {t("auth_reset_subtitle")}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {t("auth_new_password")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={t("auth_password_ph_min")}
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {t("auth_confirm_password")}
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={t("auth_password_ph_repeat")}
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={state === "loading"}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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
