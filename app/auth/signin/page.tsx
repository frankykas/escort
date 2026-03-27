"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function SignInPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
      router.push("/");
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
        {/* Logo */}
        <p className="mb-8 text-center text-2xl font-bold tracking-tight text-amber-400">
          Cleopatra
        </p>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-xl">
          <h1 className="mb-1 text-base font-semibold text-zinc-100">{t("auth_signin_title")}</h1>
          <p className="mb-6 text-xs text-zinc-500">{t("auth_signin_subtitle")}</p>

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
                placeholder="you@example.com"
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
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

          <p className="mt-5 text-center text-xs text-zinc-600">
            {t("auth_no_account")}{" "}
            <Link
              href="/auth/signup"
              className="text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {t("sign_up")}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
