"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  onClose: () => void;
};

export function SignInModal({ onClose }: Props) {
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
      onClose(); // onAuthStateChange fires → useSession updates → PublishButton appears
    }
  }

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Modal panel */}
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-xl"
          initial={{ scale: 0.96, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.96, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-100">Sign in</h2>
              <p className="mt-0.5 text-xs text-zinc-500">Provider accounts only</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
            >
              <X size={14} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Email */}
            <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Email
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

            {/* Password */}
            <div className="rounded-xl border border-white/10 bg-zinc-800/50 px-4 py-3">
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                Password
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

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-zinc-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/auth/signup"
              onClick={onClose}
              className="text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Sign Up
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </>
  );
}
