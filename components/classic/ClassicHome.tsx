"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function ClassicHome() {
  const { locale, t } = useTranslation();
  const isFr = locale === "fr";

  return (
    <main className="cleopatra-landing min-h-[calc(100svh_-_60px)] bg-[#fff4f8] text-[#111827] sm:-mb-[60px] sm:min-h-[calc(100vh_+_60px)]">
      <section className="flex min-h-[calc(100svh_-_60px)] flex-col px-7 pb-8 pt-[calc(env(safe-area-inset-top,0px)_+_36px)] sm:min-h-screen">
        <div className="mx-auto flex w-full max-w-[430px] flex-1 flex-col items-center justify-center text-center">
          <Link href="/" className="inline-flex items-center gap-2" aria-label="Cleopatra home">
            <Crown size={34} className="text-pink-500" strokeWidth={1.8} />
            <span className="font-serif text-[48px] font-semibold leading-none text-pink-500">
              Cleopatra
            </span>
          </Link>

          <h1 className="cleopatra-landing-title mt-12 max-w-[370px] text-[31px] font-semibold leading-[1.15] tracking-normal text-slate-900">
            {isFr ? "Rencontres privées," : "Private encounters,"}
            <span className="text-pink-500">
              {isFr ? " profils vérifiés" : " verified profiles"}
            </span>
            .
          </h1>

          <p className="cleopatra-landing-copy mt-5 max-w-[340px] text-[16px] leading-7 text-slate-600">
            {isFr
              ? "Découvrez des profils choisis avec discrétion, sécurité et simplicité."
              : "Discover curated profiles with discretion, security, and simplicity."}
          </p>

          <Link
            href="/explore"
            className="cleopatra-landing-cta mt-10 flex min-h-14 w-full max-w-[370px] items-center justify-center rounded-2xl bg-pink-500 px-6 text-[16px] font-bold text-white shadow-[0_18px_34px_rgba(236,72,153,0.28)] transition hover:bg-pink-400 active:scale-[0.98]"
          >
            {isFr ? "Ouvrir Cléopâtre" : "Open Cleopatra"}
          </Link>

          <p className="cleopatra-landing-auth mt-8 text-[15px] font-semibold text-slate-500">
            <Link href="/auth/signin" className="text-pink-500 transition hover:text-pink-400">
              {t("sign_in")}
            </Link>
            <span className="px-1.5 font-normal text-slate-400">
              {isFr ? "ou" : "or"}
            </span>
            <Link href="/auth/signup" className="text-pink-500 transition hover:text-pink-400">
              {t("sign_up")}
            </Link>
          </p>
        </div>

        <div className="cleopatra-landing-footer pb-[calc(env(safe-area-inset-bottom,0px)_+_4px)] text-center">
          <p className="text-[11px] leading-none text-slate-400">{isFr ? "par" : "from"}</p>
          <p className="mt-2 font-serif text-[20px] font-semibold leading-none text-pink-500">
            {isFr ? "Cléopâtre" : "Cleopatra"}
          </p>
        </div>
      </section>
    </main>
  );
}
