"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, SlidersHorizontal, CheckCircle,
  Star, X, Heart, MessageCircle, Share2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FilterDrawer, DEFAULT_FILTERS, type Filters } from "./FilterDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderCard = {
  id: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  post_id: string | null;
  caption: string | null;
  likes_count: number;
  comments_count: number;
  verification_status: "none" | "pending" | "verified";
  city: string | null;
  country_code: string | null;
  age: number | null;
  hourly_rate: number | null;
  available_until: string | null;
  incall: boolean;
  outcall: boolean;
  service_categories: string[];
  review_count: number;
  average_rating: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CHIPS = [
  { id: "all",           label: "All" },
  { id: "available",     label: "Available Now" },
  { id: "Companionship", label: "Companionship" },
  { id: "GFE",           label: "GFE" },
  { id: "Dinner Date",   label: "Dinner Date" },
  { id: "Travel",        label: "Travel" },
  { id: "Massage",       label: "Massage" },
  { id: "Couples",       label: "Couples" },
  { id: "Domination",    label: "Domination" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(pence: number | null): string {
  if (!pence) return "";
  return `CA$${Math.round(pence / 100)}/hr`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function isAvailableNow(availableUntil: string | null): boolean {
  if (!availableUntil) return false;
  return new Date(availableUntil) > new Date();
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

// ─── Stories bar ──────────────────────────────────────────────────────────────

function StoriesBar({ providers }: { providers: ProviderCard[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="border-b border-white/5 bg-black">
      <div
        className="flex gap-5 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {providers.slice(0, 15).map((p) => {
          const available = isAvailableNow(p.available_until);
          return (
            <Link
              key={p.id}
              href={`/u/${p.username}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
            >
              <div className={cn(
                "rounded-full p-[2.5px]",
                available
                  ? "bg-gradient-to-tr from-emerald-500 via-emerald-400 to-green-300"
                  : "bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300"
              )}>
                <div className="rounded-full p-[2px] bg-black">
                  {p.avatar_url ? (
                    <div className="relative h-[58px] w-[58px] overflow-hidden rounded-full">
                      <Image src={p.avatar_url} alt={p.username} fill className="object-cover" sizes="58px" />
                    </div>
                  ) : (
                    <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-zinc-800 text-base font-bold text-zinc-300">
                      {p.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
              <span className="max-w-[60px] truncate text-[10px] text-zinc-400">{p.username}</span>
            </Link>
          );
        })}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

function StoriesBarSkeleton() {
  return (
    <div className="border-b border-white/5 bg-black px-4 py-3">
      <div className="flex gap-5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
            <div className="h-[58px] w-[58px] rounded-full bg-zinc-800" />
            <div className="h-2 w-10 rounded-full bg-zinc-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreClient() {
  const { t } = useTranslation();
  const { user } = useSession();
  const [searchQuery, setSearchQuery]     = useState("");
  const [cityQuery, setCityQuery]         = useState("");
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [activeChip, setActiveChip]       = useState("all");
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [results, setResults]             = useState<ProviderCard[]>([]);
  const [loading, setLoading]             = useState(true);
  const [geoLoading, setGeoLoading]       = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [likedPostIds, setLikedPostIds]   = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds]     = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (search: string, city: string, f: Filters) => {
    setLoading(true);

    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, verification_status, city, country_code, age, hourly_rate, available_until, incall, outcall, service_categories, review_count, average_rating")
      .eq("is_provider", true)
      .order("created_at", { ascending: false })
      .limit(40);

    if (city.trim() && !search.trim()) query = query.ilike("city", `%${city.trim()}%`);
    if (search.trim()) {
      const q = search.trim().replace(/^@/, "");
      query = query.or(`username.ilike.%${q}%,city.ilike.%${q}%`);
    }
    if (f.verifiedOnly)              query = query.eq("verification_status", "verified");
    if (f.availableNow)              query = query.gt("available_until", new Date().toISOString());
    if (f.incall && !f.outcall)      query = query.eq("incall", true);
    else if (f.outcall && !f.incall) query = query.eq("outcall", true);
    if (f.categories.length > 0)     query = query.overlaps("service_categories", f.categories);
    if (f.minRate > 0)               query = query.gte("hourly_rate", f.minRate * 100);
    if (f.maxRate < DEFAULT_FILTERS.maxRate) query = query.lte("hourly_rate", f.maxRate * 100);
    if (f.minAge > DEFAULT_FILTERS.minAge)   query = query.gte("age", f.minAge);
    if (f.maxAge < DEFAULT_FILTERS.maxAge)   query = query.lte("age", f.maxAge);

    const { data } = await query;
    const providers = (data ?? []) as ProviderCard[];

    // Fetch latest post (cover + caption + stats) per provider
    const ids = providers.map((p) => p.id);
    const postMap = new Map<string, { post_id: string; cover_url: string | null; caption: string | null; likes_count: number; comments_count: number }>();

    if (ids.length > 0) {
      const { data: postData } = await supabase
        .from("status_updates")
        .select("id, provider_id, media_url, caption, likes_count, comments_count")
        .in("provider_id", ids)
        .not("media_url", "is", null)
        .order("created_at", { ascending: false });

      for (const row of (postData ?? []) as { id: string; provider_id: string; media_url: string | null; caption: string | null; likes_count: number; comments_count: number }[]) {
        if (!postMap.has(row.provider_id)) {
          postMap.set(row.provider_id, {
            post_id: row.id,
            cover_url: row.media_url,
            caption: row.caption,
            likes_count: row.likes_count ?? 0,
            comments_count: row.comments_count ?? 0,
          });
        }
      }
    }

    const enriched: ProviderCard[] = providers.map((p) => {
      const post = postMap.get(p.id);
      return {
        ...p,
        post_id: post?.post_id ?? null,
        cover_url: post?.cover_url ?? null,
        caption: post?.caption ?? null,
        likes_count: post?.likes_count ?? 0,
        comments_count: post?.comments_count ?? 0,
      };
    });

    setResults(enriched);
    setLoading(false);
  }, []);

  // Batch-fetch engagement state once results arrive
  useEffect(() => {
    if (!user || results.length === 0) return;
    const postIds = results.map((p) => p.post_id).filter(Boolean) as string[];
    const providerIds = results.map((p) => p.id);

    Promise.all([
      postIds.length > 0
        ? supabase.from("likes").select("status_update_id").eq("user_id", user.id).in("status_update_id", postIds)
        : Promise.resolve({ data: [] }),
      supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", providerIds),
    ]).then(([likesRes, followsRes]) => {
      setLikedPostIds(new Set((likesRes.data ?? []).map((r: { status_update_id: string }) => r.status_update_id)));
      setFollowedIds(new Set((followsRes.data ?? []).map((r: { following_id: string }) => r.following_id)));
    });
  }, [user, results]);

  useEffect(() => { fetchResults("", "", DEFAULT_FILTERS); }, [fetchResults]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(searchQuery, cityQuery, filters), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, cityQuery, filters, fetchResults]);

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
        } catch {}
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  }

  function handleChip(id: string) {
    setActiveChip(id);
    if (id === "all") {
      setFilters((f) => ({ ...f, availableNow: false, categories: [] }));
    } else if (id === "available") {
      setFilters((f) => ({ ...f, availableNow: true, categories: [] }));
    } else {
      setFilters((f) => ({ ...f, availableNow: false, categories: [id] }));
    }
  }

  const activeCount = countActiveFilters(filters);

  return (
    <div className="min-h-screen bg-black pb-24">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/95 backdrop-blur-xl">
        <div className="flex items-center justify-center px-4 py-[13px]">
          <span className="text-[17px] font-bold tracking-tight text-amber-400">
            {t("explore_title")}
          </span>
        </div>
      </header>

      {/* ── Stories bar ── */}
      {loading ? <StoriesBarSkeleton /> : <StoriesBar providers={results} />}

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

        <button
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition-all",
            activeCount > 0
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.12)]"
              : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
          )}
        >
          <SlidersHorizontal size={13} />
          {t("listings_filters")}
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-950">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Category chips ── */}
      <div
        className="flex gap-2 overflow-x-auto border-b border-white/5 py-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", paddingLeft: "1rem", paddingRight: "1rem" }}
      >
        {CATEGORY_CHIPS.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => handleChip(chip.id)}
              className={cn(
                "flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                active
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                  : "border-white/10 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-300"
              )}
            >
              {chip.id === "available" && (
                <span className={cn("mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle", active ? "bg-emerald-400" : "bg-zinc-600")} />
              )}
              {chip.label}
            </button>
          );
        })}
        <div className="w-2 flex-shrink-0" />
      </div>

      {/* ── Feed ── */}
      {loading ? (
        <FeedSkeleton />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-8 pt-24">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
            <Search size={28} className="text-zinc-600" />
          </div>
          <p className="text-[15px] font-semibold text-zinc-300">{t("explore_no_results")}</p>
          <p className="text-center text-[13px] leading-relaxed text-zinc-600">{t("explore_try_different")}</p>
        </div>
      ) : (
        <div>
          <p className="px-4 py-2.5 text-[12px] text-zinc-600">
            <span className="font-medium text-zinc-400">{results.length}</span>
            {" "}{t("explore_result_label")}
            {searchQuery && <span> matching &ldquo;{searchQuery}&rdquo;</span>}
            {cityQuery && !searchQuery && <span> in {cityQuery}</span>}
          </p>

          {results.map((provider, i) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <ProviderFeedCard
                provider={provider}
                userId={user?.id ?? null}
                isLiked={likedPostIds.has(provider.post_id ?? "")}
                isFollowing={followedIds.has(provider.id)}
              />
            </motion.div>
          ))}
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
    </div>
  );
}

// ─── Provider feed card ───────────────────────────────────────────────────────

function ProviderFeedCard({
  provider,
  userId,
  isLiked,
  isFollowing,
}: {
  provider: ProviderCard;
  userId: string | null;
  isLiked: boolean;
  isFollowing: boolean;
}) {
  const coverSrc = provider.cover_url ?? provider.avatar_url;
  const isVerified = provider.verification_status === "verified";
  const available = isAvailableNow(provider.available_until);
  const isOwnProfile = userId === provider.id;

  const { isLiked: liked, likesCount, toggle: toggleLike } = useLike({
    postId: provider.post_id ?? "",
    initialIsLiked: isLiked,
    initialCount: provider.likes_count,
    userId,
  });

  const { isFollowing: following, toggle: toggleFollow } = useFollow({
    profileId: provider.id,
    initialIsFollowing: isFollowing,
    userId,
  });

  function handleShare() {
    const url = `${window.location.origin}/u/${provider.username}`;
    if (navigator.share) {
      navigator.share({ title: provider.username, url });
    } else {
      navigator.clipboard.writeText(url);
    }
  }

  return (
    <article className="border-b border-zinc-900/80">

      {/* ── Post header ── */}
      <div className="flex items-center gap-3 px-4 py-3">

        {/* Avatar with ring */}
        <Link href={`/u/${provider.username}`} className="flex-shrink-0">
          <div className={cn(
            "rounded-full p-[2px]",
            available
              ? "bg-gradient-to-tr from-emerald-500 via-emerald-400 to-green-300"
              : "bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300"
          )}>
            <div className="rounded-full p-[1.5px] bg-black">
              {provider.avatar_url ? (
                <div className="relative h-9 w-9 overflow-hidden rounded-full">
                  <Image src={provider.avatar_url} alt={provider.username} fill className="object-cover" sizes="36px" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
                  {provider.username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Username + location */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/u/${provider.username}`} className="text-[14px] font-semibold text-white hover:text-zinc-300 transition-colors truncate">
              {provider.username}
            </Link>
            {isVerified && <CheckCircle size={13} className="flex-shrink-0 text-amber-400 fill-amber-400/15" />}
            {available && (
              <span className="flex flex-shrink-0 items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_4px_#34d399]" />
                <span className="text-[9px] font-bold tracking-wide text-emerald-400">LIVE</span>
              </span>
            )}
          </div>
          {provider.city && (
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{provider.city}{provider.country_code ? `, ${provider.country_code.toUpperCase()}` : ""}</p>
          )}
        </div>

        {/* Follow button */}
        {!isOwnProfile && (
          <button
            onClick={toggleFollow}
            className={cn(
              "flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all",
              following
                ? "border-white/15 bg-transparent text-zinc-400 hover:border-red-500/30 hover:text-red-400"
                : "border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}

        {/* Rate pill when no follow button (own profile) */}
        {isOwnProfile && provider.hourly_rate ? (
          <div className="flex-shrink-0 rounded-full border border-amber-400/25 bg-amber-400/8 px-3 py-1">
            <span className="text-[12px] font-bold text-amber-400">{formatRate(provider.hourly_rate)}</span>
          </div>
        ) : null}
      </div>

      {/* ── Cover image ── */}
      <Link href={`/u/${provider.username}`} className="block relative aspect-square w-full bg-zinc-900">
        {coverSrc ? (
          <Image src={coverSrc} alt={provider.username} fill className="object-cover" sizes="100vw" />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
            <span className="text-7xl font-black text-zinc-800">{provider.username[0].toUpperCase()}</span>
          </div>
        )}
      </Link>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        {/* Like */}
        <button
          onClick={toggleLike}
          disabled={!userId || !provider.post_id}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <Heart
            size={22}
            className={cn(
              "transition-all duration-150",
              liked ? "fill-red-500 text-red-500 scale-110" : "text-zinc-300"
            )}
          />
        </button>

        {/* Comment */}
        <Link
          href={`/u/${provider.username}`}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5"
        >
          <MessageCircle size={22} className="text-zinc-300" />
        </Link>

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5"
        >
          <Share2 size={22} className="text-zinc-300" />
        </button>

        {/* Rate pill pushed to the right */}
        {!isOwnProfile && provider.hourly_rate ? (
          <div className="ml-auto rounded-full border border-amber-400/25 bg-amber-400/8 px-3 py-1">
            <span className="text-[12px] font-bold text-amber-400">{formatRate(provider.hourly_rate)}</span>
          </div>
        ) : null}
      </div>

      {/* ── Stats ── */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-0.5">
        {likesCount > 0 && (
          <p className="text-[13px] font-semibold text-white">
            {formatCount(likesCount)} {likesCount === 1 ? "like" : "likes"}
          </p>
        )}
        {provider.comments_count > 0 && (
          <p className="text-[13px] text-zinc-500">
            {formatCount(provider.comments_count)} {provider.comments_count === 1 ? "comment" : "comments"}
          </p>
        )}
      </div>

      {/* ── Caption ── */}
      {provider.caption && (
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-zinc-200">
          <Link href={`/u/${provider.username}`} className="font-semibold text-white hover:text-zinc-300">
            {provider.username}
          </Link>
          {"  "}
          {provider.caption}
        </p>
      )}

      {/* ── Service tags + rating ── */}
      {(provider.incall || provider.outcall || provider.service_categories.length > 0 || provider.average_rating !== null) && (
        <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
          {provider.age && <span className="text-[12px] text-zinc-500">{provider.age} yrs</span>}
          {provider.incall && (
            <span className="rounded-full border border-white/8 bg-zinc-900 px-2.5 py-0.5 text-[11px] text-zinc-400">In-call</span>
          )}
          {provider.outcall && (
            <span className="rounded-full border border-white/8 bg-zinc-900 px-2.5 py-0.5 text-[11px] text-zinc-400">Out-call</span>
          )}
          {provider.service_categories.slice(0, 2).map((cat) => (
            <span key={cat} className="rounded-full border border-white/8 bg-zinc-900 px-2.5 py-0.5 text-[11px] text-zinc-500">{cat}</span>
          ))}
          {provider.average_rating !== null && provider.review_count > 0 && (
            <div className="ml-auto flex items-center gap-1">
              <Star size={11} className="fill-amber-400 text-amber-400" />
              <span className="text-[12px] font-semibold text-white">{Number(provider.average_rating).toFixed(1)}</span>
              <span className="text-[11px] text-zinc-600">({provider.review_count})</span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse border-b border-zinc-900/80">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 rounded-full bg-zinc-800" />
              <div className="h-2 w-20 rounded-full bg-zinc-800/60" />
            </div>
            <div className="h-7 w-16 rounded-full bg-zinc-800" />
          </div>
          <div className="aspect-square w-full bg-zinc-800" />
          <div className="flex gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-zinc-800" />
            <div className="h-6 w-6 rounded-full bg-zinc-800" />
            <div className="h-6 w-6 rounded-full bg-zinc-800" />
          </div>
          <div className="px-4 pb-2">
            <div className="h-3 w-20 rounded-full bg-zinc-800" />
          </div>
          <div className="px-4 pb-4">
            <div className="h-3 w-3/4 rounded-full bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
