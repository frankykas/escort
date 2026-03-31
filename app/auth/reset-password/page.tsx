"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type State = "idle" | "loading" | "sent";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setState("loading");

    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/update-password` }
    );

    if (resetErr) {
      setError(resetErr.message);
      setState("idle");
      return;
    }

    setState("sent");
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

        {state === "sent" ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 text-center backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10">
              <CheckCircle size={24} className="text-amber-400" />
            </div>
            <h2 className="text-base font-semibold text-zinc-100">Check your email</h2>
            <p className="mt-2 text-sm text-zinc-400">
              If an account exists for{" "}
              <span className="text-zinc-200">{email}</span>, you&apos;ll receive a
              password reset link shortly.
            </p>
            <Link
              href="/auth/signin"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              <ArrowLeft size={14} />
              Back to Sign In
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-8 backdrop-blur-xl">
            <h1 className="mb-1 text-base font-semibold text-zinc-100">Reset your password</h1>
            <p className="mb-6 text-xs text-zinc-500">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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

              {error && <p className="text-xs text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={state === "loading"}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-zinc-600">
              Remember your password?{" "}
              <Link
                href="/auth/signin"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Sign in
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
