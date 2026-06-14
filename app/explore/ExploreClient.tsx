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
import { SearchModal } from "@/components/social/SearchModal";
import { ActivityIndicator } from "@/components/ui/ActivityIndicator";
import { useSection } from "@/contexts/SectionContext";
import { SectionToggle } from "@/components/ui/SectionToggle";

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
  provider_last_seen_at: string | null;
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
  provider_last_seen_at: string | null;
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
  provider_last_seen_at: string | null;
  is_bumped: boolean;
  bump_tier: number;
  images: ListingImageEntry[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

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

const CREATOR_CHIPS = [
  { id: "all",          label: "All" },
  { id: "trending",     label: "Trending" },
  { id: "new",          label: "New Creators" },
  { id: "live",         label: "Live Now" },
  { id: "photos",       label: "Photos" },
  { id: "videos",       label: "Videos" },
  { id: "free",         label: "Free" },
  { id: "subscriptions", label: "Subscriptions" },
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
    <div className="bg-white pt-1 pb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-0.5">
        <Sparkles size={12} className="text-pink-400 fill-pink-400/30" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-pink-400">
          {t("explore_featured")}
        </span>
      </div>

      <div className="flex gap-2.5 overflow-x-auto px-4 pt-1.5 pb-2 scrollbar-hide">
        {bumps.map((bump) => {
          const isVerified = bump.provider_verified === "verified";

          return (
            <Link
              key={bump.listing_id}
              href={`/listings/${bump.listing_id}`}
              className="group relative flex-shrink-0 focus:outline-none"
            >
              {/* Pink frame + glow */}
              <div className="rounded-[16px] bg-gradient-to-b from-pink-200 to-pink-100 p-[1.5px] shadow-[0_6px_16px_-6px_rgba(244,114,182,0.45)] transition-all group-hover:shadow-[0_8px_20px_-4px_rgba(244,114,182,0.55)]">
                <div className="relative h-[150px] w-[110px] overflow-hidden rounded-[14px] bg-white">
                  {(bump.images?.[0]?.url ?? bump.provider_avatar) ? (
                    <Image
                      src={bump.images?.[0]?.url ?? bump.provider_avatar!}
                      alt={bump.provider_username}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="110px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-pink-50">
                      <span className="text-2xl font-bold text-pink-300">
                        {bump.provider_username[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Dark gradient overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Bump tier badge */}
                  <div className="absolute top-1.5 right-1.5">
                    <span className={cn(
                      "flex items-center gap-0.5 rounded-full px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-wider shadow-sm",
                      bump.bump_tier === 3
                        ? "bg-gradient-to-r from-pink-500 to-pink-400 text-white"
                        : bump.bump_tier === 2
                        ? "bg-gradient-to-r from-violet-500 to-pink-400 text-white"
                        : "bg-gradient-to-r from-sky-400 to-pink-400 text-white"
                    )}>
                      <Crown size={8} className="fill-white" />
                      {bump.bump_tier === 3 ? "VIP" : bump.bump_tier === 2 ? "PRO" : "HOT"}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute inset-x-0 bottom-0 px-2 pb-2 space-y-0.5">
                    <div className="flex items-center gap-0.5">
                      <p className="text-[12px] font-bold text-white leading-tight truncate">
                        {bump.provider_username}
                      </p>
                      {isVerified && (
                        <CheckCircle size={10} className="flex-shrink-0 text-pink-300 fill-pink-300/30" />
                      )}
                    </div>

                    <ActivityIndicator
                      lastSeenAt={bump.provider_last_seen_at}
                      compact
                      labelMode="short"
                      className="border-0 bg-transparent px-0 py-0 text-[9px] font-bold text-white"
                    />

                    <div className="flex items-center gap-1">
                      <span className="rounded-full bg-pink-500 px-1.5 py-[2px] text-[10px] font-bold text-white shadow-sm">
                        {formatRate(bump.listing_rate)}
                      </span>
                    </div>
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
    <div className="bg-white px-4 pt-2 pb-3">
      <div className="flex gap-2.5 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[154px] w-[114px] flex-shrink-0 rounded-[16px] bg-gray-100 shimmer" />
        ))}
      </div>
    </div>
  );
}

// ─── StarredBar — premium star listings carousel ─────────────────────────────

function SponsoredAdBanner() {
  return (
    <div className="border-y border-pink-100 bg-white px-4 py-3">
      <a
        href="https://secretbenefits.ca"
        target="_blank"
        rel="noreferrer sponsored"
        className="group block overflow-hidden rounded-2xl border border-pink-100 bg-gradient-to-r from-[#fff7fb] via-white to-[#fff1f8] p-4 shadow-sm transition hover:border-pink-200 hover:shadow-md"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-pink-500">
              <Sparkles size={10} className="fill-pink-100" />
              Sponsored
            </div>
            <p className="truncate text-[15px] font-black text-slate-800">SecretBenefits.ca</p>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Premium dating connections for adults.
            </p>
          </div>
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pink-500 text-white transition group-hover:bg-pink-400">
            <ChevronRight size={18} />
          </span>
        </div>
      </a>
    </div>
  );
}

function StarredBar({ stars }: { stars: StarredListing[] }) {
  const { t } = useTranslation();
  const [, setTick] = useState(0);

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
    <div className="bg-gradient-to-b from-pink-50/60 to-white pt-1 pb-2">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 pt-2 pb-0.5">
        <Star size={13} className="text-pink-500 fill-pink-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-pink-500">
          {t("star_featured_section")}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-2.5 scrollbar-hide">
        {stars.map((star) => {
          const isVerified = star.provider_verified === "verified";
          const countdown = starCountdown(star.star_expires_at);

          return (
            <Link
              key={star.listing_id}
              href={`/listings/${star.listing_id}`}
              className="group relative flex-shrink-0 focus:outline-none"
            >
              {/* Pink frame + drop glow */}
              <div className="rounded-[20px] bg-gradient-to-b from-pink-300 to-pink-200 p-[2.5px] shadow-[0_10px_22px_-8px_rgba(244,114,182,0.55)] transition-all group-hover:shadow-[0_14px_28px_-6px_rgba(244,114,182,0.7)]">
                <div className="relative h-[220px] w-[160px] overflow-hidden rounded-[18px] bg-white">
                  {(star.images?.[0]?.url ?? star.provider_avatar) ? (
                    <Image
                      src={star.images?.[0]?.url ?? star.provider_avatar!}
                      alt={star.provider_username}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="160px"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-pink-50">
                      <span className="text-4xl font-bold text-pink-300">
                        {star.provider_username[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                  {/* Animated shimmer overlay */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />

                  {/* Countdown — top-left */}
                  {countdown && (
                    <div className="absolute top-2 left-2">
                      <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-[3px] text-[10px] font-semibold text-slate-700 backdrop-blur-md shadow-sm">
                        <Clock size={10} className="text-slate-500" />
                        {countdown}
                      </span>
                    </div>
                  )}

                  {/* VEDETTE badge — top-right */}
                  <div className="absolute top-2 right-2">
                    <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-pink-400 px-2 py-[3px] text-[9px] font-bold uppercase tracking-wider text-white shadow-md shadow-pink-500/40">
                      <Star size={9} className="fill-white" />
                      {t("star_badge")}
                    </span>
                  </div>

                  {/* Bottom info */}
                  <div className="absolute inset-x-0 bottom-0 px-3 pb-3 space-y-1">
                    <div className="flex items-center gap-1">
                      <p className="text-[15px] font-bold text-white leading-tight truncate">
                        {star.provider_username}
                        {star.provider_age && (
                          <span className="font-normal text-white/60">, {star.provider_age}</span>
                        )}
                      </p>
                      {isVerified && (
                        <CheckCircle size={12} className="flex-shrink-0 text-pink-300 fill-pink-300/30" />
                      )}
                    </div>

                    {star.provider_city && (
                      <p className="flex items-center gap-1 text-[11px] font-medium text-white/80 truncate">
                        <MapPin size={10} />
                        {star.provider_city}
                      </p>
                    )}

                    <ActivityIndicator
                      lastSeenAt={star.provider_last_seen_at}
                      labelMode="short"
                      className="border-white/20 bg-white/15 px-2 py-[2px] text-[9px] font-bold text-white backdrop-blur-md"
                    />

                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="rounded-full bg-pink-500 px-2 py-[3px] text-[11px] font-bold text-white shadow-sm">
                        {formatRate(star.listing_rate)}
                      </span>
                      {star.service_type && (
                        <span className="truncate text-[10px] font-medium text-white/85">
                          {star.service_type}
                        </span>
                      )}
                    </div>
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
        className="block relative aspect-[4/5] w-full bg-gray-50 overflow-hidden"
      >
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-6xl font-bold text-gray-300">{fallbackInitial}</span>
        </div>
      </Link>
    );
  }

  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden bg-gray-50"
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

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

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

      {isVerified && (
        <div className="absolute bottom-3 left-3 pointer-events-none">
          <span className="flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-pink-500 backdrop-blur-md border border-pink-200">
            <CheckCircle size={10} className="fill-pink-100" />
            {t("explore_verified")}
          </span>
        </div>
      )}

      {providerAge && (
        <div className="absolute bottom-3 right-3 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 backdrop-blur-md pointer-events-none">
          {providerAge} {t("explore_yrs")}
        </div>
      )}

      {count > 1 && (
        <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/80 backdrop-blur-sm pointer-events-none">
          {current + 1}/{count}
        </div>
      )}

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

function formatDuration(mins: number | null): string | null {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

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

// ─── ListingFeedCard ──────────────────────────────────────────────────────────

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
      <div
        className={cn(
          "relative overflow-hidden rounded-[20px] bg-white",
          isBumped
            ? "p-[1.5px] bg-gradient-to-br from-pink-300/60 via-sky-300/30 to-pink-300/40"
            : "ring-1 ring-gray-200 shadow-sm"
        )}
      >
        <div className="relative overflow-hidden rounded-[19px] bg-white">
          <div className="relative">
            <ImageGallery
              images={allImages}
              listingId={listing.listing_id}
              fallbackInitial={listing.provider_username[0]?.toUpperCase() ?? "?"}
              isVerified={false}
              providerAge={null}
            />

            {isBumped && (
              <div className="pointer-events-none absolute top-3 right-3 z-10">
                <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-sky-400 px-2.5 py-[5px] text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg">
                  <Crown size={9} className="stroke-[2.5]" />
                  VIP
                </span>
              </div>
            )}

            {listing.service_type && (
              <div className="pointer-events-none absolute top-3 left-3 z-10">
                <span className="rounded-full bg-white/85 px-2.5 py-[5px] text-[10px] font-semibold uppercase tracking-wider text-slate-700 backdrop-blur-md ring-1 ring-gray-200">
                  {listing.service_type}
                </span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4 pb-3.5 pt-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
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
                      className="ml-0.5 translate-y-[1px] text-pink-300 fill-pink-300/30 drop-shadow-[0_1px_4px_rgba(244,114,182,0.5)]"
                    />
                  )}
                </div>
                {listing.provider_city && (
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/75">
                    <MapPin size={10} className="text-pink-300" />
                    {listing.provider_city}
                  </p>
                )}
                <ActivityIndicator
                  lastSeenAt={listing.provider_last_seen_at}
                  labelMode="short"
                  className="mt-1.5 border-white/20 bg-white/15 px-2 py-[2px] text-[10px] font-bold text-white backdrop-blur-md"
                />
              </Link>
            </div>
          </div>

          <Link href={`/listings/${listing.listing_id}`} className="block">
            <div className="px-4 pt-3.5 pb-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex-1 text-[15px] font-bold text-slate-800 leading-snug line-clamp-1 tracking-tight">
                  {listing.listing_title}
                </h3>
                <div className="flex-shrink-0 flex items-baseline gap-1 leading-none">
                  <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                    from
                  </span>
                  <span className="text-[18px] font-black text-pink-500 tabular-nums">
                    ${(listing.listing_rate / 100).toFixed(0)}
                  </span>
                </div>
              </div>

              {(duration || callType) && (
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {duration && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-[3px] text-[10.5px] font-medium text-slate-600">
                      <Clock size={9.5} className="text-slate-400" />
                      {duration}
                    </span>
                  )}
                  {callType === "incall" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-[3px] text-[10.5px] font-medium text-slate-600">
                      <Home size={9.5} className="text-slate-400" />
                      {t("explore_incall")}
                    </span>
                  )}
                  {callType === "outcall" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-[3px] text-[10.5px] font-medium text-slate-600">
                      <Car size={9.5} className="text-slate-400" />
                      {t("explore_outcall")}
                    </span>
                  )}
                  {callType === "both" && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-[3px] text-[10.5px] font-medium text-slate-600">
                      <Home size={9.5} className="text-slate-400" />
                      {t("explore_incall_outcall")}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-slate-300">
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
  const { section, isCreatorSection } = useSection();
  const router = useRouter();
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
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [toolsOpen, setToolsOpen]             = useState(false);
  const [, setUserCity]                   = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 15;

  const { pulling, refreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([fetchPosts(cityQuery), fetchBumps(cityQuery), fetchStars(cityQuery)]);
    },
  });

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

  useEffect(() => {
    fetchPosts("");
    fetchBumps("");
    fetchStars("");
  }, [fetchPosts, fetchBumps, fetchStars]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPosts(cityQuery);
      fetchBumps(cityQuery);
      fetchStars(cityQuery);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, fetchPosts, fetchBumps, fetchStars]);

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
          if (city) setCityQuery(city);
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

  const displayPosts = feedPosts;

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED SECTION HEADER — always visible at top
  // ══════════════════════════════════════════════════════════════════════════

  const sectionHeader = (
    <div className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur-xl backdrop-saturate-150"
      style={{ borderColor: isCreatorSection ? "#ede9fe" : "#f3e8ff50" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span
          className="text-[20px] font-bold tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage: isCreatorSection
              ? "linear-gradient(to right, #8b5cf6, #c084fc)"
              : "linear-gradient(to right, #f472b6, #38bdf8)",
          }}
        >
          Cleopatra
        </span>
        <SectionToggle compact className="w-[210px]" />
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SHARED FEED — reused in all views (escort section shows listings too)
  // ══════════════════════════════════════════════════════════════════════════

  const feedContent = (
    <>
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
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
            </div>
          )}
          {!hasMore && feedPosts.length > 0 && (
            <div className="py-8 text-center text-[11px] uppercase tracking-widest text-slate-300">
              {t("explore_all_caught_up")}
            </div>
          )}
        </div>
      )}
    </>
  );

  const sharedOverlays = (
    <>
      <ExploreToolsFab
        activeCount={activeCount}
        cityActive={!!cityQuery}
        onClick={() => setToolsOpen(true)}
        label={t("explore_tools_title")}
      />

      <ExploreToolsSheet
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        cityQuery={cityQuery}
        setCityQuery={setCityQuery}
        handleNearMe={handleNearMe}
        geoLoading={geoLoading}
        onOpenSearch={() => setSearchModalOpen(true)}
        onOpenFilters={() => setDrawerOpen(true)}
        activeCount={activeCount}
        t={t}
      />

      <AnimatePresence>
        {drawerOpen && (
          <FilterDrawer
            filters={filters}
            onApply={(f) => { setFilters(f); setDrawerOpen(false); setActiveChip("all"); }}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>

      <SearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // CREATOR SECTION — content-focused, purple accent, no listings
  // ══════════════════════════════════════════════════════════════════════════

  if (isCreatorSection) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-[#fafbfc] pb-24">
        <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} pullDistance={pullDistance} progress={progress} />

        {sectionHeader}

        {/* Creator trending strip */}
        <CreatorTrendingStrip />

        {/* Creator category chips */}
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide bg-white border-b border-violet-100/50">
          {CREATOR_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveChip(chip.id)}
              className={cn(
                "flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap",
                activeChip === chip.id
                  ? "bg-violet-500 text-white shadow-sm"
                  : "bg-violet-50 text-violet-600 hover:bg-violet-100"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Content feed — no listings */}
        {feedContent}

        {sharedOverlays}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ESCORT SECTION — classifieds + listings (current design, pink accent)
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fafbfc] pb-24">
      <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} pullDistance={pullDistance} progress={progress} />

      {sectionHeader}

      {!loading && <StarredBar stars={starredListings} />}
      {loading ? <BumpedBarSkeleton /> : <BumpedBar bumps={bumpedListings} />}
      {!loading && <SponsoredAdBanner />}

      {!isProvider && (
        <AnimatePresence>
          {categoriesOpen && <CategoriesDrawer onClose={() => setCategoriesOpen(false)} />}
        </AnimatePresence>
      )}

      {!loading && feedPosts.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <div className="h-1 w-1 rounded-full bg-pink-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            {t("explore_latest")}
          </span>
        </div>
      )}

      {feedContent}

      {sharedOverlays}
    </div>
  );
}

// ─── CreatorTrendingStrip — horizontal scroll of trending creator avatars ─────

function CreatorTrendingStrip() {
  const [creators, setCreators] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .eq("provider_type", "creator")
      .order("created_at", { ascending: false })
      .limit(15)
      .then(({ data }) => { if (data) setCreators(data); });
  }, []);

  if (creators.length === 0) return null;

  return (
    <div className="bg-gradient-to-b from-violet-50/60 to-white pt-1 pb-2">
      <div className="flex items-center gap-2 px-4 pt-2 pb-0.5">
        <Sparkles size={12} className="text-violet-400 fill-violet-400/30" />
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-400">
          Trending Creators
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-2.5 scrollbar-hide">
        {creators.map((c) => (
          <Link
            key={c.id}
            href={`/u/${c.username}`}
            className="group flex flex-shrink-0 flex-col items-center gap-1.5"
          >
            <div className="rounded-full p-[2px] bg-gradient-to-tr from-violet-400 via-purple-400 to-fuchsia-400 shadow-[0_4px_12px_-4px_rgba(139,92,246,0.5)] transition-shadow group-hover:shadow-[0_6px_16px_-2px_rgba(139,92,246,0.6)]">
              <div className="rounded-full p-[1.5px] bg-white">
                {c.avatar_url ? (
                  <div className="relative h-[56px] w-[56px] overflow-hidden rounded-full">
                    <Image
                      src={c.avatar_url}
                      alt={c.username}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-violet-50 text-sm font-bold text-violet-400">
                    {c.username[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="max-w-[64px] truncate text-[10px] font-semibold text-slate-600">
              {c.username}
            </span>
          </Link>
        ))}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="px-3 pt-3 pb-5">
          <div className="overflow-hidden rounded-[20px] ring-1 ring-gray-200 bg-white shadow-sm">
            <div className="aspect-[4/5] w-full bg-gray-100 shimmer" />
            <div className="px-4 pt-3.5 pb-4 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-48 rounded-full bg-gray-100 shimmer" />
                <div className="h-4 w-14 rounded-full bg-gray-100 shimmer" />
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 w-14 rounded-full bg-gray-50 shimmer" />
                <div className="h-5 w-20 rounded-full bg-gray-50 shimmer" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ExploreToolsFab — floating pink button that opens the tools sheet ────────

function ExploreToolsFab({
  activeCount,
  cityActive,
  onClick,
  label,
}: {
  activeCount: number;
  cityActive: boolean;
  onClick: () => void;
  label: string;
}) {
  const total = activeCount + (cityActive ? 1 : 0);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="fixed right-4 bottom-[calc(60px+env(safe-area-inset-bottom,0px)+14px)] z-30 flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(246,51,154)] text-white shadow-[0_12px_28px_-8px_rgba(246,51,154,0.75)] transition-transform active:scale-95"
    >
      <SlidersHorizontal size={18} />
      {total > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-pink-500 shadow ring-1 ring-pink-200">
          {total}
        </span>
      )}
    </button>
  );
}

// ─── ExploreToolsSheet — bottom-sheet with Near-me / Search / Filters rows ────

function ExploreToolsSheet({
  open,
  onClose,
  cityQuery,
  setCityQuery,
  handleNearMe,
  geoLoading,
  onOpenSearch,
  onOpenFilters,
  activeCount,
  t,
}: {
  open: boolean;
  onClose: () => void;
  cityQuery: string;
  setCityQuery: (v: string) => void;
  handleNearMe: () => void;
  geoLoading: boolean;
  onOpenSearch: () => void;
  onOpenFilters: () => void;
  activeCount: number;
  t: (key: import("@/lib/i18n/en").TranslationKey) => string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl bg-white pb-[calc(env(safe-area-inset-bottom,0px)+22px)] shadow-[0_-14px_40px_-10px_rgba(0,0,0,0.22)]"
          >
            <div className="mx-auto my-2 h-1 w-10 rounded-full bg-gray-200" />
            <div className="px-5 pt-2 pb-1">
              <h3 className="text-[15px] font-bold text-slate-800">{t("explore_tools_title")}</h3>
              <p className="text-[12px] text-slate-400">{t("explore_tools_subtitle")}</p>
            </div>
            <div className="space-y-2 px-5 pt-3">
              <button
                type="button"
                onClick={() => handleNearMe()}
                disabled={geoLoading}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[13px] font-medium transition-colors disabled:opacity-40",
                  cityQuery
                    ? "border-pink-300 bg-pink-50 text-pink-600"
                    : "border-gray-200 bg-gray-50 text-slate-600 hover:border-pink-200"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <MapPin size={15} className="flex-shrink-0 text-pink-500" />
                  <span className="truncate">
                    {geoLoading ? "…" : cityQuery ? cityQuery : t("explore_near_you")}
                  </span>
                </span>
                {cityQuery ? (
                  <span
                    role="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCityQuery(""); }}
                    className="flex-shrink-0 text-pink-400 hover:text-pink-500"
                  >
                    <X size={15} />
                  </span>
                ) : (
                  <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
                )}
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onOpenSearch(); }}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-[13px] font-medium text-slate-600 transition-colors hover:border-pink-200"
              >
                <span className="flex items-center gap-2.5">
                  <Search size={15} className="text-pink-500" />
                  <span className="truncate">{t("explore_search_ph")}</span>
                </span>
                <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
              </button>

              <button
                type="button"
                onClick={() => { onClose(); onOpenFilters(); }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-[13px] font-medium transition-colors",
                  activeCount > 0
                    ? "border-pink-300 bg-pink-50 text-pink-600"
                    : "border-gray-200 bg-gray-50 text-slate-600 hover:border-pink-200"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <SlidersHorizontal size={15} className="text-pink-500" />
                  {t("explore_filters")}
                </span>
                {activeCount > 0 ? (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-pink-500 px-1.5 text-[10px] font-bold text-white">
                    {activeCount}
                  </span>
                ) : (
                  <ChevronRight size={15} className="flex-shrink-0 text-slate-300" />
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
