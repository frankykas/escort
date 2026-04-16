"use client";

import Link from "next/link";
import { ArrowRight, Search, PlusCircle, ShieldCheck, Zap, MapPin, MessageCircle, Eye, Lock, Globe } from "lucide-react";
import { NavAuth } from "@/components/social/NavAuth";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function ClassicHome() {
  const { t } = useTranslation();

  return (
    <main className="flex flex-col flex-1">
      {/* ── Nav ── */}
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-amber-400">
            Cleopatra
          </span>
          <nav className="flex items-center gap-4 text-sm text-zinc-400">
            <Link href="/listings" className="hover:text-zinc-50 transition-colors">
              {t("classic_browse")}
            </Link>
            <NavAuth />
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-24 text-center sm:py-36">
        {/* Radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
        >
          <div className="h-[500px] w-[700px] rounded-full bg-amber-500/10 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-medium text-amber-300">
          <Zap size={12} className="fill-amber-400 text-amber-400" />
          {t("classic_badge")}
        </div>

        {/* Heading */}
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl">
          {t("classic_heading_1")}{" "}
          <span className="text-amber-400">{t("classic_heading_2")}</span>
        </h1>

        {/* Subtext */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          {t("classic_subtitle")}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/explore"
            className="flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-95"
          >
            <Search size={16} />
            {t("classic_cta_browse")}
          </Link>
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 rounded-full border border-zinc-700 px-7 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50 active:scale-95"
          >
            <PlusCircle size={16} />
            {t("classic_cta_join")}
            <ArrowRight size={14} className="text-zinc-500" />
          </Link>
        </div>

        {/* Trust row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-amber-400/70" />
            {t("classic_trust_id")}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-amber-400/70" />
            {t("classic_trust_city")}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400/70" />
            {t("classic_trust_discreet")}
          </span>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section className="border-t border-zinc-800 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-zinc-50 sm:text-3xl">
            {t("classic_how_title")}
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { icon: Eye, num: "1", title: t("classic_how_1_title"), desc: t("classic_how_1_desc") },
              { icon: MessageCircle, num: "2", title: t("classic_how_2_title"), desc: t("classic_how_2_desc") },
              { icon: Lock, num: "3", title: t("classic_how_3_title"), desc: t("classic_how_3_desc") },
            ].map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
                  <step.icon size={24} />
                </div>
                <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-400/70">
                  {step.num}
                </span>
                <h3 className="mb-2 text-lg font-semibold text-zinc-50">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Cleopatra ── */}
      <section className="border-t border-zinc-800 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-zinc-50 sm:text-3xl">
            {t("classic_feat_title")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { icon: ShieldCheck, title: t("classic_feat_1_title"), desc: t("classic_feat_1_desc") },
              { icon: Zap, title: t("classic_feat_2_title"), desc: t("classic_feat_2_desc") },
              { icon: Lock, title: t("classic_feat_3_title"), desc: t("classic_feat_3_desc") },
              { icon: Globe, title: t("classic_feat_4_title"), desc: t("classic_feat_4_desc") },
            ].map((feat) => (
              <div key={feat.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                <feat.icon size={20} className="mb-3 text-amber-400" />
                <h3 className="mb-1 text-base font-semibold text-zinc-50">{feat.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-400">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Provider CTA ── */}
      <section className="border-t border-zinc-800 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-2xl font-bold text-zinc-50 sm:text-3xl">
            {t("classic_provider_title")}
          </h2>
          <p className="mb-8 text-base leading-relaxed text-zinc-400">
            {t("classic_provider_desc")}
          </p>
          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-8 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-95"
          >
            <PlusCircle size={16} />
            {t("classic_provider_cta")}
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

    </main>
  );
}
