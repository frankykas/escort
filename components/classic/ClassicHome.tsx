"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowRight, Search, PlusCircle, ShieldCheck, Zap, MapPin } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { NavAuth } from "@/components/social/NavAuth";
import { CreateStatusDrawer } from "@/components/social/CreateStatusDrawer";

export function ClassicHome() {
  const router = useRouter();
  const { user } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handlePostAdClick() {
    if (user) {
      setDrawerOpen(true);
    } else {
      router.push("/auth/signup");
    }
  }

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
              Browse
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
          Now Live — Browse thousands of local listings
        </div>

        {/* Heading */}
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-zinc-50 sm:text-6xl lg:text-7xl">
          Buy &amp; Sell.{" "}
          <span className="text-amber-400">Locally.</span>
        </h1>

        {/* Subtext */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          The premium classifieds marketplace. Post a free ad in seconds, reach
          real buyers in your area, and close deals fast.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/listings"
            className="flex items-center gap-2 rounded-full bg-amber-400 px-7 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-95"
          >
            <Search size={16} />
            Browse Listings
          </Link>
          <button
            onClick={handlePostAdClick}
            className="flex items-center gap-2 rounded-full border border-zinc-700 px-7 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-50 active:scale-95"
          >
            <PlusCircle size={16} />
            Post an Ad
            <ArrowRight size={14} className="text-zinc-500" />
          </button>
        </div>

        {/* Trust row */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-amber-400/70" />
            Free to list
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={14} className="text-amber-400/70" />
            Local &amp; nationwide
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={14} className="text-amber-400/70" />
            Live in under 60 seconds
          </span>
        </div>
      </section>

      {/* Create Status Drawer */}
      <AnimatePresence>
        {drawerOpen && user && (
          <CreateStatusDrawer
            userId={user.id}
            onClose={() => setDrawerOpen(false)}
            onPublished={() => {
              setDrawerOpen(false);
              router.refresh();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
