"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const nextPath = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      router.push(nextPath && nextPath.startsWith("/") ? nextPath : "/");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafbfc] px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <p className="mb-8 text-center text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-400 to-sky-400 bg-clip-text text-transparent">
          Cleopatra
        </p>

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-base font-semibold text-slate-800">{t("auth_signin_title")}</h1>
          <p className="mb-6 text-xs text-slate-400">{t("auth_signin_subtitle")}</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t("auth_email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder={t("auth_email_ph")}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                {t("auth_password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder={t("auth_password_ph_dots")}
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-300"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end">
              <Link
                href="/auth/reset-password"
                className="text-[11px] text-slate-400 transition-colors hover:text-pink-500"
              >
                {t("auth_forgot_password")}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(246,51,154)] py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {t("submitting")}
                </>
              ) : (
                t("sign_in")
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-400">
            {t("auth_no_account")}{" "}
            <Link
              href="/auth/signup"
              className="text-pink-500 transition-colors hover:text-pink-600"
            >
              {t("sign_up")}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
