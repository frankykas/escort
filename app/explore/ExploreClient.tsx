"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, SlidersHorizontal, CheckCircle, LayoutGrid,
  X, Clock, Star, ChevronRight, Loader2, Sparkles, Crown,
  Home, Car,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FilterDrawer, DEFAULT_FILTERS, type Filters } from "./FilterDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoriesDrawer } from "@/components/ui/CategoriesDrawer";
import { FeedPost } from "@/components/social/FeedPost";
import type { FeedPostData } from "@/components/social/SocialHome";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefresh";
import { ScrollReveal } from "@/components/ui/AmbientEffects";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingImageEntry = { url: string; sort_order: number };

type BumpedListing = {
  listing_id: string;
  listing_title: string;
  listing_rate: number;
  service_type: string | null;
  provider_id: string;
  provider_username: string;
  provider_avatar: string | null;
  provider_verified: string;
  provider_city: string | null;
  provider_age: number | null;
  bump_tier: number;
  bump_expires_at: string;
  images: ListingImageEntry[];
};

type StarredListing = {
  listing_id: string;
  listing_title: string;
  listing_rate: number;
  service_type: string | null;
  duration_minutes: number | null;
  provider_id: string;
  provider_username: string;
  provider_avatar: string | null;
  provider_verified: string;
  provider_city: string | null;
  provider_age: number | null;
  star_expires_at: string;
  images: ListingImageEntry[];
};

type ExploreListing = {
  listing_id: string;
  listing_title: string;
  listing_description: string | null;
  listing_rate: number;
  service_type: string | null;
  duration_minutes: number | null;
  perks: string[];
  listing_created_at: string;
  provider_id: string;
  provider_username: string;
  provider_avatar: string | null;
  provider_verified: string;
  provider_city: string | null;
  provider_age: number | null;
  is_bumped: boolean;
  bump_tier: number;
  images: ListingImageEntry[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

// LeoList-inspired categories — service-type buckets that match how clients
// actually search. Order: discovery filters first, then experience types
// (GFE/PSE are the two most-searched), then specialties.
const CATEGORY_CHIPS = [
  { id: "all",          label: "All" },
  { id: "available",    label: "Available Now" },
  { id: "vip",          label: "VIP" },
  { id: "new",          label: "New Faces" },
  { id: "GFE",          label: "GFE" },
  { id: "PSE",          label: "PSE" },
  { id: "Massage",      label: "Body Rub" },
  { id: "Dinner Date",  label: "Dinner Date" },
  { id: "Travel",       label: "Travel" },
  { id: "Couples",      label: "Couples" },
  { id: "BDSM",         label: "BDSM & Fetish" },
  { id: "Domination",   label: "Domination" },
  { id: "Tantric",      label: "Tantric" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

function timeAgo(date: string | null): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.verifiedOnly) n++;
  if (f.availableNow) n++;
  if (f.incall) n++;
  if (f.outcall) n++;
  n += f.categories.length;
  if (f.minRate !== DEFAULT_FILTERS.minRate || f.maxRate !== DEFAULT_FILTERS.maxRate) n++;
  if (f.minAge !== DEFAULT_FILTERS.minAge || f.maxAge !== DEFAULT_FILTERS.maxAge) n++;
  return n;
}

// ─── BumpedBar — premium bumped listings carousel ─────────────────────────────

function BumpedBar({ bumps }: { bumps: BumpedListing[] }) {
  const { t } = useTranslation();
  if (bumps.length === 0) return null;

  return (
    <div className="border-b border-white/5 bg-black">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Sparkles size={12} className="text-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/80">
          {t("explore_featured")}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-2.5 scrollbar-hide">
        {bumps.map((bump) => {
          const isVerified = bump.provider_verified === "verified";

          return (
            <Link
              key={bump.listing_id}
              href={`/listings/${bump.listing_id}`}
              className="group relative flex-shrink-0 focus:outline-none"
            >
              <div className="relative h-[200px] w-[140px] overflow-hidden rounded-2xl ring-1 ring-amber-400/20 transition-all group-hover:ring-amber-400/40">
                {/* Photo — listing image first, then provider avatar */}
                {(bump.images?.[0]?.url ?? bump.provider_avatar) ? (
                  <Image
                    src={bump.images?.[0]?.url ?? bump.provider_avatar!}
                    alt={bump.provider_username}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="140px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <span className="text-3xl font-bold text-zinc-500">
                      {bump.provider_username[0]?.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Dark gradient overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                {/* Bump tier badge — top right */}
                <div className="absolute top-2 right-2">
                  <span className={cn(
                    "flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[8px] font-bold uppercase tracking-wider backdrop-blur-sm",
                    bump.bump_tier === 3
                      ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/30"
                      : bump.bump_tier === 2
                      ? "bg-violet-400/20 text-violet-300 ring-1 ring-violet-400/30"
                      : "bg-sky-400/20 text-sky-300 ring-1 ring-sky-400/30"
                  )}>
                    <Crown size={8} />
                    {bump.bump_tier === 3 ? "VIP" : bump.bump_tier === 2 ? "PRO" : "HOT"}
                  </span>
                </div>

                {/* Bottom info */}
                <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 space-y-1">
                  {/* Name + verified */}
                  <div className="flex items-center gap-1">
                    <p className="text-[12px] font-bold text-white leading-tight truncate">
                      {bump.provider_username}
                      {bump.provider_age && (
                        <span className="font-normal text-white/60">, {bump.provider_age}</span>
                      )}
                    </p>
                    {isVerified && (
                      <CheckCircle size={10} className="flex-shrink-0 text-amber-400 fill-amber-400/20" />
                    )}
                  </div>

                  {/* City */}
                  {bump.provider_city && (
                    <p className="flex items-center gap-0.5 text-[9px] font-medium text-zinc-400 truncate">
                      <MapPin size={7} />
                      {bump.provider_city}
                    </p>
                  )}

                  {/* Rate pill */}
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-amber-400/15 px-2 py-[2px] text-[10px] font-bold text-amber-400">
                      {formatRate(bump.listing_rate)}
                    </span>
                    {bump.service_type && (
                      <span className="truncate text-[9px] text-zinc-500">
                        {bump.service_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

function BumpedBarSkeleton() {
  return (
    <div className="border-b border-white/5 bg-black px-4 py-3">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[200px] w-[140px] flex-shrink-0 rounded-2xl bg-zinc-800/60 shimmer" />
        ))}
      </div>
    </div>
  );
}

// ─── StarredBar — premium star listings carousel ─────────────────────────────

function StarredBar({ stars }: { stars: StarredListing[] }) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

  // Update countdown every 60s
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(iv);
  }, []);

  if (stars.length === 0) return null;

  function starCountdown(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  return (
    <div className="border-b border-amber-400/10 bg-black">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Star size={12} className="text-amber-400 fill-amber-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400">
          {t("star_featured_section")}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 py-2.5 scrollbar-hide">
        {stars.map((star) => {
          const isVerified = star.provider_verified === "verified";
          const countdown = starCountdown(star.star_expires_at);

          return (
            <Link
              key={star.listing_id}
              href={`/listings/${star.listing_id}`}
              className="group relative flex-shrink-0 focus:outline-none"
            >
              <div className="relative h-[240px] w-[180px] overflow-hidden rounded-2xl ring-2 ring-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.15)] transition-all group-hover:ring-amber-400/60 group-hover:shadow-[0_0_30px_rgba(251,191,36,0.25)]">
                {/* Photo */}
                {(star.images?.[0]?.url ?? star.provider_avatar) ? (
                  <Image
                    src={star.images?.[0]?.url ?? star.provider_avatar!}
                    alt={star.provider_username}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="180px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                    <span className="text-3xl font-bold text-zinc-500">
                      {star.provider_username[0]?.toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Dark gradient overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

                {/* Animated shimmer overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />

                {/* STAR badge — top right */}
                <div className="absolute top-2 right-2">
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-2.5 py-[3px] text-[8px] font-bold uppercase tracking-wider text-zinc-950 shadow-lg shadow-amber-400/30">
                    <Star size={8} className="fill-zinc-950" />
                    {t("star_badge")}
                  </span>
                </div>

                {/* Countdown — top left */}
                {countdown && (
                  <div className="absolute top-2 left-2">
                    <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-[3px] text-[9px] font-medium text-amber-400 backdrop-blur-sm">
                      <Clock size={8} />
                      {countdown}
                    </span>
                  </div>
                )}

                {/* Bottom info */}
                <div className="absolute inset-x-0 bottom-0 px-3 pb-3 space-y-1">
                  {/* Name + verified */}
                  <div className="flex items-center gap-1">
                    <p className="text-[13px] font-bold text-white leading-tight truncate">
                      {star.provider_username}
                      {star.provider_age && (
                        <span className="font-normal text-white/60">, {star.provider_age}</span>
                      )}
                    </p>
                    {isVerified && (
                      <CheckCircle size={11} className="flex-shrink-0 text-amber-400 fill-amber-400/20" />
                    )}
                  </div>

                  {/* City */}
                  {star.provider_city && (
                    <p className="flex items-center gap-0.5 text-[10px] font-medium text-zinc-400 truncate">
                      <MapPin size={8} />
                      {star.provider_city}
                    </p>
                  )}

                  {/* Rate pill */}
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-amber-400/20 px-2.5 py-[2px] text-[11px] font-bold text-amber-400">
                      {formatRate(star.listing_rate)}
                    </span>
                    {star.service_type && (
                      <span className="truncate text-[9px] text-zinc-500">
                        {star.service_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── ImageGallery — swipeable image carousel ────────────────────────────────

function ImageGallery({
  images,
  listingId,
  fallbackInitial,
  isVerified,
  providerAge,
}: {
  images: string[];
  listingId: string;
  fallbackInitial: string;
  isVerified: boolean;
  providerAge: number | null;
}) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  const count = images.length;

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }

  function handleTouchEnd() {
    const threshold = 50;
    if (touchDeltaX.current < -threshold && current < count - 1) {
      setCurrent((p) => p + 1);
    } else if (touchDeltaX.current > threshold && current > 0) {
      setCurrent((p) => p - 1);
    }
  }

  if (count === 0) {
    return (
      <Link
        href={`/listings/${listingId}`}
        className="block relative aspect-[4/5] w-full bg-zinc-900 overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
          <span className="text-6xl font-bold text-zinc-600">{fallbackInitial}</span>
        </div>
      </Link>
    );
  }

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <Link href={`/listings/${listingId}`} className="block h-full w-full">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${current * 100}%)`, width: `${count * 100}%` }}
        >
          {images.map((url, i) => (
            <div key={url} className="relative h-full" style={{ width: `${100 / count}%` }}>
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="100vw"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </Link>

      {/* Bottom gradient */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Dot indicators */}
      {count > 1 && (
        <div className="absolute top-3 inset-x-0 flex justify-center gap-1 pointer-events-none">
          {images.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[3px] rounded-full transition-all duration-300",
                i === current ? "w-5 bg-white" : "w-5 bg-white/30"
              )}
              style={{ width: `calc((100% - ${(count - 1) * 4}px - 32px) / ${count})` }}
            />
          ))}
        </div>
      )}

      {/* Verified badge — bottom left */}
      {isVerified && (
        <div className="absolute bottom-3 left-3 pointer-events-none">
          <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 backdrop-blur-md border border-amber-400/20">
            <CheckCircle size={10} className="fill-amber-400/20" />
            {t("explore_verified")}
          </span>
        </div>
      )}

      {/* Age badge — bottom right */}
      {providerAge && (
        <div className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-md pointer-events-none">
          {providerAge} {t("explore_yrs")}
        </div>
      )}

      {/* Image counter */}
      {count > 1 && (
        <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm pointer-events-none">
          {current + 1}/{count}
        </div>
      )}

      {/* Tap zones for desktop (left/right click areas) */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.preventDefault(); setCurrent((p) => Math.max(0, p - 1)); }}
            className="absolute left-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer"
            aria-label="Previous photo"
          />
          <button
            onClick={(e) => { e.preventDefault(); setCurrent((p) => Math.min(count - 1, p + 1)); }}
            className="absolute right-0 top-0 bottom-0 w-1/4 z-10 cursor-pointer"
            aria-label="Next photo"
          />
        </>
      )}
    </div>
  );
}

// ─── Taxonomy helpers ────────────────────────────────────────────────────────
// Curated signals derived from structured data. No freeform marketing copy —
// no neighborhood names ("Gastown"), no vague qualifiers ("Cultured
// conversation"). Every chip here comes from a known vocabulary.

function formatDuration(mins: number | null): string | null {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Infer call-type (incall / outcall / both) from the listing's perks array
// using only the canonical keywords. Any other perks text is ignored — we
// never surface freeform tags on the card.
function inferCallType(perks: string[] | null | undefined): "incall" | "outcall" | "both" | null {
  if (!perks || perks.length === 0) return null;
  const joined = perks.join(" ").toLowerCase();
  const hasIn = /\bincall\b/.test(joined);
  const hasOut = /\boutcall\b/.test(joined);
  if (hasIn && hasOut) return "both";
  if (hasIn) return "incall";
  if (hasOut) return "outcall";
  return null;
}

// ─── ListingFeedCard — editorial / Tryst-inspired layout ──────────────────────
//
// Design intent:
//   • Image dominates. Name, age, city overlay the photo like a magazine spread
//   • Premium states earn real emphasis: bumped cards get a gold gradient frame
//     and a VIP ribbon; verified providers get a gold checkmark
//   • Below-image strip is minimal: title + rate + a single row of taxonomy
//     chips (service type, duration, call-type). No freeform perks, no
//     duplicated CTAs, no header avatar row
//   • Whole card is clickable → listing detail

function ListingFeedCard({ listing }: { listing: ExploreListing }) {
  const { t } = useTranslation();
  const isVerified = listing.provider_verified === "verified";
  const isBumped = listing.is_bumped;
  const callType = inferCallType(listing.perks);
  const duration = formatDuration(listing.duration_minutes);

  const allImages = listing.images?.length > 0
    ? listing.images.map((img) => img.url)
    : listing.provider_avatar
    ? [listing.provider_avatar]
    : [];

  return (
    <article className="relative px-3 pt-3 pb-5">
      {/* Premium frame for bumped listings — subtle gold gradient border */}
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] bg-zinc-950",
          isBumped
            ? "p-[1.5px] bg-gradient-to-br from-amber-300/60 via-amber-500/20 to-amber-300/40"
            : "ring-1 ring-white/5"
        )}
      >
        <div className="relative overflow-hidden rounded-[19px] bg-zinc-950">
          {/* ── Image gallery with overlaid identity card ── */}
          <div className="relative">
            <ImageGallery
              images={allImages}
              listingId={listing.listing_id}
              fallbackInitial={listing.provider_username[0]?.toUpperCase() ?? "?"}
              isVerified={false /* rendered in overlay below */}
              providerAge={null /* rendered in overlay below */}
            />

            {/* VIP ribbon — top right, only for bumped */}
            {isBumped && (
              <div className="pointer-events-none absolute top-3 right-3 z-10">
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 px-2.5 py-[5px] text-[9px] font-black uppercase tracking-[0.12em] text-black shadow-[0_2px_12px_rgba(251,191,36,0.35)]">
                  <Crown size={9} className="stroke-[2.5]" />
                  VIP
                </span>
              </div>
            )}

            {/* Service type — top left, subtle */}
            {listing.service_type && (
              <div className="pointer-events-none absolute top-3 left-3 z-10">
                <span className="rounded-full bg-black/55 px-2.5 py-[5px] text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md ring-1 ring-white/10">
                  {listing.service_type}
                </span>
              </div>
            )}

            {/* Identity overlay — bottom of image, magazine-style */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-3.5 pt-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
              <Link
                href={`/u/${listing.provider_username}`}
                className="pointer-events-auto inline-block"
              >
                <div className="flex items-baseline gap-1.5">
                  <h4 className="text-[22px] font-black text-white tracking-tight leading-none drop-shadow-lg">
                    {listing.provider_username}
                  </h4>
                  {listing.provider_age && (
                    <span className="text-[16px] font-semibold text-white/70 leading-none">
                      · {listing.provider_age}
                    </span>
                  )}
                  {isVerified && (
                    <CheckCircle
                      size={14}
                      className="ml-0.5 translate-y-[1px] text-amber-400 fill-amber-400/30 drop-shadow-[0_1px_4px_rgba(251,191,36,0.4)]"
                    />
                  )}
                </div>
                {listing.provider_city && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/75">
                    <MapPin size={10} className="text-amber-400/80" />
                    {listing.provider_city}
                  </p>
                )}
              </Link>
            </div>
          </div>

          {/* ── Below-image strip ── */}
          <Link href={`/listings/${listing.listing_id}`} className="block">
            <div className="px-4 pt-3.5 pb-4">
              {/* Title + rate */}
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex-1 text-[15px] font-bold text-white leading-snug line-clamp-1 tracking-tight">
                  {listing.listing_title}
                </h3>
                <div className="flex-shrink-0 flex items-baseline gap-1 leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
                    from
                  </span>
                  <span className="text-[18px] font-black text-amber-400 tabular-nums">
                    ${(listing.listing_rate / 100).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Taxonomy row — service type already in overlay; show duration + call-type */}
              {(duration || callType) && (
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {duration && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] text-[10.5px] font-medium text-zinc-300">
                      <Clock size={9.5} className="text-zinc-500" />
                      {duration}
                    </span>
                  )}
                  {callType === "incall" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] text-[10.5px] font-medium text-zinc-300">
                      <Home size={9.5} className="text-zinc-500" />
                      {t("explore_incall")}
                    </span>
                  )}
                  {callType === "outcall" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] text-[10.5px] font-medium text-zinc-300">
                      <Car size={9.5} className="text-zinc-500" />
                      {t("explore_outcall")}
                    </span>
                  )}
                  {callType === "both" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-[3px] text-[10.5px] font-medium text-zinc-300">
                      <Home size={9.5} className="text-zinc-500" />
                      {t("explore_incall_outcall")}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    {timeAgo(listing.listing_created_at)}
                  </span>
                </div>
              )}
            </div>
          </Link>
        </div>
      </div>
    </article>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreClient() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { isProvider, profile } = useProfile();
  const router = useRouter();
  const [searchQuery, setSearchQuery]     = useState("");
  const [cityQuery, setCityQuery]         = useState("");
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [activeChip, setActiveChip]       = useState("all");
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [feedPosts, setFeedPosts]         = useState<FeedPostData[]>([]);
  const [likedPostIds, setLikedPostIds]   = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds]     = useState<Set<string>>(new Set());
  const [bumpedListings, setBumpedListings] = useState<BumpedListing[]>([]);
  const [starredListings, setStarredListings] = useState<StarredListing[]>([]);
  const [sessionSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [geoLoading, setGeoLoading]       = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [, setUserCity]                   = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 15;

  const { pulling, refreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([fetchPosts(cityQuery), fetchBumps(cityQuery), fetchStars(cityQuery)]);
    },
  });

  // Fetch bumped listings for the premium bar.
  // Bumps are paid premium placements — always show them nationwide unless
  // the user has *explicitly* filtered by city in the search bar. Do NOT fall
  // back to the viewer's own profile city (that would hide bumps from nearby
  // cities — e.g. a Quebec City client would never see Montreal bumps).
  const fetchBumps = useCallback(async (city: string) => {
    const cityTrimmed = city.trim() || null;

    const { data, error } = await supabase.rpc("get_bumped_listings", {
      p_city: cityTrimmed,
      p_limit: 20,
    });

    if (error) {
      console.error("Bumps error:", error.message);
      setBumpedListings([]);
    } else {
      setBumpedListings((data ?? []) as BumpedListing[]);
    }
  }, []);

  // Fetch starred listings for the premium "En vedette" carousel
  const fetchStars = useCallback(async (city: string) => {
    const cityTrimmed = city.trim() || null;

    const { data, error } = await supabase.rpc("get_starred_listings", {
      p_city: cityTrimmed,
      p_seed: sessionSeed,
      p_limit: 6,
    });

    if (error) {
      console.error("Stars error:", error.message);
      setStarredListings([]);
    } else {
      setStarredListings((data ?? []) as StarredListing[]);
    }
  }, [sessionSeed]);

  // Fetch social feed posts for the main feed
  const fetchPosts = useCallback(async (city: string) => {
    setLoading(true);
    setHasMore(true);

    const cityTrimmed = city.trim() || null;

    const { data, error } = await supabase.rpc("get_feed_posts", {
      p_country_code: null,
      p_city: cityTrimmed,
      p_limit: PAGE_SIZE,
      p_offset: 0,
      p_comments_per_post: 3,
    });

    if (error) {
      console.error("Feed posts error:", error.message);
      setFeedPosts([]);
      setHasMore(false);
    } else {
      const results = (data ?? []) as FeedPostData[];
      setFeedPosts(results);
      if (results.length < PAGE_SIZE) setHasMore(false);
    }

    setLoading(false);
  }, []);

  // Load engagement state (likes + follows) for current posts
  useEffect(() => {
    if (!user || feedPosts.length === 0) {
      setLikedPostIds(new Set());
      setFollowedIds(new Set());
      return;
    }
    const postIds = feedPosts.map((p) => p.post_id);
    const profileIds = [...new Set(feedPosts.map((p) => p.provider_id))];

    Promise.all([
      supabase
        .from("likes")
        .select("status_update_id")
        .eq("user_id", user.id)
        .in("status_update_id", postIds),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id)
        .in("following_id", profileIds),
    ]).then(([likesRes, followsRes]) => {
      setLikedPostIds(new Set((likesRes.data ?? []).map((r) => r.status_update_id as string)));
      setFollowedIds(new Set((followsRes.data ?? []).map((r) => r.following_id as string)));
    });
  }, [user, feedPosts]);

  // Load next page of posts
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);

    const cityTrimmed = cityQuery.trim() || null;

    const { data, error } = await supabase.rpc("get_feed_posts", {
      p_country_code: null,
      p_city: cityTrimmed,
      p_limit: PAGE_SIZE,
      p_offset: feedPosts.length,
      p_comments_per_post: 3,
    });

    if (error) {
      console.error("Load more error:", error.message);
      setHasMore(false);
    } else {
      const newPosts = (data ?? []) as FeedPostData[];
      const existingIds = new Set(feedPosts.map((p) => p.post_id));
      const fresh = newPosts.filter((p) => !existingIds.has(p.post_id));

      if (fresh.length === 0) {
        setHasMore(false);
      } else {
        setFeedPosts((prev) => [...prev, ...fresh]);
        if (newPosts.length < PAGE_SIZE) setHasMore(false);
      }
    }

    setLoadingMore(false);
  }, [feedPosts, loadingMore, hasMore, loading, cityQuery]);

  // Fetch user's city for geo-targeted bumps
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("city")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.city) setUserCity(data.city as string);
      });
  }, [user]);

  // Initial load
  useEffect(() => {
    fetchPosts("");
    fetchBumps("");
    fetchStars("");
  }, [fetchPosts, fetchBumps, fetchStars]);

  // Debounced city changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPosts(cityQuery);
      fetchBumps(cityQuery);
      fetchStars(cityQuery);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, fetchPosts, fetchBumps, fetchStars]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  async function handleNearMe() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "";
          if (city) { setCityQuery(city); setSearchQuery(""); }
        } catch { /* ignore */ }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  }

  function handleChip(id: string) {
    setActiveChip(id);
  }

  const activeCount = countActiveFilters(filters);

  // Client-side search filter on posts
  const displayPosts = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return feedPosts;
    return feedPosts.filter((p) =>
      p.provider_username?.toLowerCase().includes(q) ||
      p.caption?.toLowerCase().includes(q)
    );
  })();

  // ══════════════════════════════════════════════════════════════════════════
  // PROVIDER VIEW — simplified, shows their own listings + bumps preview
  // ══════════════════════════════════════════════════════════════════════════

  if (isProvider) {
    return (
      <div className="min-h-screen bg-black pb-24">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-black/95 backdrop-blur-xl">
          <div className="flex items-center justify-center px-4 py-[13px]">
            <span className="text-[17px] font-bold tracking-tight text-[#FCBA03]">{t("feed_title")}</span>
          </div>
        </header>

        <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} pullDistance={pullDistance} progress={progress} />

        {/* Starred listings — premium "En vedette" section */}
        {!loading && <StarredBar stars={starredListings} />}

        {/* Bumped listings preview */}
        {loading ? <BumpedBarSkeleton /> : <BumpedBar bumps={bumpedListings} />}

        {/* Feed header */}
        {!loading && feedPosts.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="h-1 w-1 rounded-full bg-[#FCBA03]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
              {t("explore_latest")}
            </span>
          </div>
        )}

        {/* Social feed */}
        {loading ? (
          <FeedSkeleton />
        ) : feedPosts.length === 0 ? (
          <EmptyState variant="no-results" />
        ) : (
          <div className="flex flex-col pt-1">
            {feedPosts.map((post, i) => (
              <ScrollReveal key={post.post_id} delay={Math.min(i * 40, 300)}>
                <FeedPost
                  post={post}
                  isLiked={likedPostIds.has(post.post_id)}
                  isFollowing={followedIds.has(post.provider_id)}
                  userId={user?.id ?? null}
                  priority={i === 0}
                />
              </ScrollReveal>
            ))}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex items-center justify-center py-6 text-zinc-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {!hasMore && feedPosts.length > 0 && (
              <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-700">
                {t("explore_all_caught_up")}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CLIENT VIEW — full discovery UI
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-black pb-24">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/95 backdrop-blur-xl">
        <div className="flex items-center justify-center px-4 py-[13px]">
          <span className="text-[17px] font-bold tracking-tight text-[#FCBA03]">
            {t("explore_title")}
          </span>
        </div>
      </header>

      {/* ── Pull to refresh ── */}
      <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} pullDistance={pullDistance} progress={progress} />

      {/* ── Starred listings — premium "En vedette" section ── */}
      {!loading && <StarredBar stars={starredListings} />}

      {/* ── Bumped listings bar (premium spot) ── */}
      {loading ? <BumpedBarSkeleton /> : <BumpedBar bumps={bumpedListings} />}

      {/* ── Control strip: Near Me | Search | Filters ── */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-black px-4 py-3">
        <button
          onClick={handleNearMe}
          disabled={geoLoading}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-40",
            cityQuery
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
              : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-amber-400/30 hover:text-amber-400"
          )}
        >
          <MapPin size={13} />
          {geoLoading ? "…" : cityQuery ? cityQuery : t("explore_near_you")}
          {cityQuery && (
            <span
              role="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCityQuery(""); }}
              className="ml-0.5 text-amber-400/60 hover:text-amber-400"
            >
              <X size={11} />
            </span>
          )}
        </button>

        <div className="relative flex-1">
          <Search size={14} className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
            searchFocused || searchQuery ? "text-amber-400" : "text-zinc-500"
          )} />
          <input
            type="text"
            placeholder={t("explore_search_ph")}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); if (e.target.value) setCityQuery(""); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              "w-full rounded-full border bg-zinc-900 py-2 pl-8 pr-7 text-[13px] text-zinc-100 placeholder-zinc-600 outline-none transition-all",
              searchFocused || searchQuery ? "border-amber-400/30 ring-1 ring-amber-400/10" : "border-white/10"
            )}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
              <X size={13} />
            </button>
          )}
        </div>

      </div>

      {/* ── Social feed ── */}
      {loading ? (
        <FeedSkeleton />
      ) : displayPosts.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <div className="flex flex-col pt-1">
          {displayPosts.map((post, i) => (
            <ScrollReveal key={post.post_id} delay={Math.min(i * 40, 300)}>
              <FeedPost
                post={post}
                isLiked={likedPostIds.has(post.post_id)}
                isFollowing={followedIds.has(post.provider_id)}
                userId={user?.id ?? null}
                priority={i === 0}
              />
            </ScrollReveal>
          ))}

          {/* Pagination sentinel + loader */}
          {!searchQuery.trim() && (
            <>
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex items-center justify-center py-6 text-zinc-500">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
              {!hasMore && feedPosts.length > 0 && (
                <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-700">
                  {t("explore_all_caught_up")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {drawerOpen && (
          <FilterDrawer
            filters={filters}
            onApply={(f) => { setFilters(f); setDrawerOpen(false); setActiveChip("all"); }}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {categoriesOpen && <CategoriesDrawer onClose={() => setCategoriesOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 pt-3 pb-5">
          <div className="overflow-hidden rounded-[20px] ring-1 ring-white/5 bg-zinc-950">
            <div className="aspect-[4/5] w-full bg-zinc-800 shimmer" />
            <div className="px-4 pt-3.5 pb-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-48 rounded-full bg-zinc-800 shimmer" />
                <div className="h-4 w-14 rounded-full bg-zinc-800 shimmer" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-14 rounded-full bg-zinc-800/60 shimmer" />
                <div className="h-5 w-20 rounded-full bg-zinc-800/60 shimmer" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
