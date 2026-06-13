"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { SignInModal } from "./SignInModal";

export function NavAuth() {
  const { user, loading } = useSession();
  const { t } = useTranslation();
  const [username, setUsername] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch username once signed in
  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }
    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setUsername(data?.username ?? null));
  }, [user]);

  // Render nothing during the initial session check to avoid flash
  if (loading) return <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {username && (
          <Link
            href={`/u/${username}`}
            className="text-xs text-slate-500 transition-colors hover:text-slate-700"
          >
            @{username}
          </Link>
        )}
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-slate-300 transition-colors hover:text-slate-600"
        >
          {t("sign_out")}
        </button>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/auth/signup"
        className="text-xs text-slate-500 transition-colors hover:text-slate-700"
      >
        {t("sign_up")}
      </Link>
      <button
        onClick={() => setIsModalOpen(true)}
        className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-gray-300 hover:text-slate-700"
      >
        {t("sign_in")}
      </button>

      <AnimatePresence>
        {isModalOpen && (
          <SignInModal onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
