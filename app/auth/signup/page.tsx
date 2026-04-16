"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

type State = "idle" | "loading" | "success";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ageConfirmed) {
      setError(t("auth_err_age"));
      return;
    }
    if (!termsAccepted) {
      setError(t("auth_err_terms"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth_err_pw_mismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth_err_pw_short"));
      return;
    }

    setState("loading");
    const { data, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setState("idle");
      return;
    }

    if (data.session) {
      if (nextPath && nextPath.startsWith("/")) {
        localStorage.setItem("signup_next", nextPath);
      }
      router.push("/onboarding");
    } else {
      setState("success");
    }
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

        {state === "success" ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10">
              <CheckCircle size={24} className="text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">{t("auth_account_created")}</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {t("auth_confirm_sent")}{" "}
              <span className="text-zinc-200">{email}</span>.
            </p>
            <Link
              href="/"
              className="mt-6 flex w-full items-center justify-center rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              {t("nav_home")}
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-xl">
            <h1 className="mb-1 text-base font-semibold text-zinc-100">{t("auth_signup_title")}</h1>
            <p className="mb-6 text-xs text-zinc-500">{t("auth_signup_subtitle")}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {t("auth_email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder={t("auth_email_ph")}
                  className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  {t("auth_password")}
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

              {/* Age confirmation */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-zinc-800 text-amber-400 accent-amber-400"
                />
                <span className="text-[12px] text-zinc-500 leading-snug group-hover:text-zinc-400 transition">
                  {t("auth_age_confirm_pre")} <strong className="text-zinc-300">{t("auth_age_18")}</strong>
                </span>
              </label>

              {/* Terms & Privacy */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-white/20 bg-zinc-800 text-amber-400 accent-amber-400"
                />
                <span className="text-[12px] text-zinc-500 leading-snug group-hover:text-zinc-400 transition">
                  {t("auth_terms_pre")}{" "}
                  <Link href="/legal/terms" className="text-amber-400/80 hover:text-amber-400 underline underline-offset-2">
                    {t("auth_terms")}
                  </Link>{" "}
                  {t("auth_and")}{" "}
                  <Link href="/legal/privacy" className="text-amber-400/80 hover:text-amber-400 underline underline-offset-2">
                    {t("auth_privacy")}
                  </Link>
                </span>
              </label>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={state === "loading" || !ageConfirmed || !termsAccepted}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("sign_up")
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-zinc-600">
              {t("auth_have_account")}{" "}
              <Link
                href="/auth/signin"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                {t("sign_in")}
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
