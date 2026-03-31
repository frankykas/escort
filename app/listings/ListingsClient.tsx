"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, SlidersHorizontal, CheckCircle,
  Clock, Zap, LayoutGrid, List, X, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ListingsFilterDrawer, DEFAULT_FILTERS, type ListingFilters } from "./ListingsFilterDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type ListingCard = {
  id: string;
  title: string;
  rate: number;
  duration_minutes: number | null;
  service_type: string | null;
  created_at: string;
  expires_at: string | null;
  cover_url: string | null;
  provider: {
    id: string;
    username: string;
    avatar_url: string | null;
    city: string | null;
    age: number | null;
    verification_status: "none" | "pending" | "verified";
    available_until: string | null;
    incall: boolean;
    outcall: boolean;
    last_seen_at: string | null;
  };
};

type SortBy = "newest" | "price_asc" | "price_desc";
type ViewMode = "list" | "grid";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "all",           label: "All" },
  { id: "Escorts",       label: "Escorts" },
  { id: "GFE",           label: "GFE" },
  { id: "Companionship", label: "Companionship" },
  { id: "Massage",       label: "Massage" },
  { id: "Dinner Date",   label: "Dinner Date" },
  { id: "Travel",        label: "Travel" },
  { id: "Couples",       label: "Couples" },
  { id: "Domination",    label: "Domination" },
];

// Labels resolved at render time via t() — see useSortOptions() below
const SORT_KEYS: { id: SortBy; key: string }[] = [
  { id: "newest",     key: "listings_sort_newest" },
  { id: "price_asc",  key: "listings_sort_price_asc" },
  { id: "price_desc", key: "listings_sort_price_desc" },
];

const PAGE_SIZE = 20;
const TODAY_CUTOFF = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(cents: number, durationMinutes: number | null): string {
  const dollars = Math.round(cents / 100);
  const amount = `CA$${dollars.toLocaleString()}`;
  if (!durationMinutes) return amount;
  if (durationMinutes < 60) return `${amount} / ${durationMinutes}min`;
  const hrs = durationMinutes / 60;
  return `${amount} / ${hrs % 1 === 0 ? `${hrs}hr` : `${hrs}hrs`}`;
}

function isAvailableNow(until: string | null): boolean {
  if (!until) return false;
  return new Date(until) > new Date();
}

function isNewToday(iso: string): boolean {
  return iso >= TODAY_CUTOFF;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

function countFilters(f: ListingFilters): number {
  let n = 0;
  if (f.verifiedOnly) n++;
  if (f.availableNow) n++;
  if (f.incall) n++;
  if (f.outcall) n++;
  if (f.minRate > DEFAULT_FILTERS.minRate || f.maxRate < DEFAULT_FILTERS.maxRate) n++;
  return n;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ListingsClient() {
  const { t } = useTranslation();
  const [category, setCategory]     = useState("all");
  const [search, setSearch]         = useState("");
  const [sortBy, setSortBy]         = useState<SortBy>("newest");
  const [viewMode, setViewMode]     = useState<ViewMode>("list");
  const [filters, setFilters]       = useState<ListingFilters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen]     = useState(false);
  const [listings, setListings]     = useState<ListingCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const dbOffsetRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const SORT_OPTIONS = SORT_KEYS.map((s) => ({ id: s.id, label: t(s.key as Parameters<typeof t>[0]) }));

  const buildQuery = useCallback((cat: string, sort: SortBy, f: ListingFilters, offset: number) => {
    let query = supabase
      .from("listings")
      .select(`
        id, title, rate, duration_minutes, service_type, created_at, expires_at,
        provider:profiles!listings_provider_id_fkey(
          id, username, avatar_url, city, age,
          verification_status, available_until, incall, outcall
        )
      `)
      .eq("is_active", true)
      .range(offset, offset + PAGE_SIZE - 1);

    if (cat !== "all") query = query.eq("service_type", cat);
    if (f.availableNow) query = query.gt(
      "profiles.available_until" as never, new Date().toISOString()
    );
    if (f.minRate > 0) query = query.gte("rate", f.minRate * 100);
    if (f.maxRate < DEFAULT_FILTERS.maxRate) query = query.lte("rate", f.maxRate * 100);

    switch (sort) {
      case "price_asc":  query = query.order("rate", { ascending: true });  break;
      case "price_desc": query = query.order("rate", { ascending: false }); break;
      default:           query = query.order("created_at", { ascending: false });
    }
    return query;
  }, []);

  const applyClientFilters = useCallback((rows: ListingCard[], q: string, f: ListingFilters) => {
    let filtered = rows;
    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title.toLowerCase().includes(lq) ||
          r.provider?.username?.toLowerCase().includes(lq) ||
          r.provider?.city?.toLowerCase().includes(lq)
      );
    }
    if (f.verifiedOnly) filtered = filtered.filter((r) => r.provider?.verification_status === "verified");
    if (f.availableNow) filtered = filtered.filter((r) => isAvailableNow(r.provider?.available_until ?? null));
    if (f.incall && !f.outcall) filtered = filtered.filter((r) => r.provider?.incall);
    if (f.outcall && !f.incall) filtered = filtered.filter((r) => r.provider?.outcall);
    return filtered;
  }, []);

  const hydrateCoverImages = useCallback(async (rows: ListingCard[]): Promise<ListingCard[]> => {
    const providerIds = [...new Set(rows.map((r) => r.provider?.id).filter(Boolean))];
    const coverMap = new Map<string, string>();
    if (providerIds.length > 0) {
      const { data: covers } = await supabase
        .from("status_updates")
        .select("provider_id, media_url")
        .in("provider_id", providerIds)
        .not("media_url", "is", null)
        .order("created_at", { ascending: false });

      for (const row of covers ?? []) {
        const r = row as { provider_id: string; media_url: string };
        if (!coverMap.has(r.provider_id)) coverMap.set(r.provider_id, r.media_url);
      }
    }
    return rows.map((r) => ({
      ...r,
      cover_url: coverMap.get(r.provider?.id ?? "") ?? null,
    }));
  }, []);

  const fetchListings = useCallback(async (
    cat: string,
    q: string,
    sort: SortBy,
    f: ListingFilters,
  ) => {
    setLoading(true);
    setHasMore(true);
    dbOffsetRef.current = 0;

    const { data } = await buildQuery(cat, sort, f, 0);
    let rows = (data ?? []) as unknown as ListingCard[];

    dbOffsetRef.current = rows.length;
    setHasMore(rows.length >= PAGE_SIZE);
    rows = applyClientFilters(rows, q, f);
    rows = await hydrateCoverImages(rows);

    setListings(rows);
    setLoading(false);
  }, [buildQuery, applyClientFilters, hydrateCoverImages]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const { data } = await buildQuery(category, sortBy, filters, dbOffsetRef.current);
    let rows = (data ?? []) as unknown as ListingCard[];

    dbOffsetRef.current += rows.length;
    setHasMore(rows.length >= PAGE_SIZE);
    rows = applyClientFilters(rows, search, filters);
    rows = await hydrateCoverImages(rows);

    setListings((prev) => [...prev, ...rows]);
    setLoadingMore(false);
  }, [loadingMore, hasMore, buildQuery, category, sortBy, filters, applyClientFilters, search, hydrateCoverImages]);

  useEffect(() => { fetchListings("all", "", "newest", DEFAULT_FILTERS); }, [fetchListings]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => fetchListings(category, search, sortBy, filters),
      300
    );
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [category, search, sortBy, filters, fetchListings]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const liveNow    = listings.filter((l) => isAvailableNow(l.provider?.available_until ?? null));
  const newToday   = listings.filter((l) => isNewToday(l.created_at));
  const filterCount = countFilters(filters);
  const currentSort = SORT_OPTIONS.find((s) => s.id === sortBy)!;

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/95 backdrop-blur-xl backdrop-saturate-150">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-[20px] font-bold text-white tracking-tight">{t("listings_title")}</h1>
            {/* List / Grid toggle */}
            <div className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-zinc-900 p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                  viewMode === "list" ? "bg-amber-400 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                )}
                aria-label={t("listings_view_list")}
              >
                <List size={14} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
                  viewMode === "grid" ? "bg-amber-400 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                )}
                aria-label={t("listings_view_grid")}
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder={t("listings_search_ph")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-white/8 bg-zinc-900 py-2.5 pl-10 pr-10 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition focus:border-amber-400/30 focus:ring-1 focus:ring-amber-400/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div
          className="flex gap-2 overflow-x-auto px-4 pb-3"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={cn(
                  "flex-shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-medium transition-all",
                  active
                    ? "border-amber-400/50 bg-amber-400 text-zinc-950 shadow-[0_0_14px_rgba(251,191,36,0.25)]"
                    : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
                )}
              >
                {cat.label}
              </button>
            );
          })}
          <div className="w-2 flex-shrink-0" />
        </div>
      </header>

      {/* ── Sort + Filter bar ── */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        {/* Sort dropdown trigger */}
        <button
          onClick={() => setSortOpen(true)}
          className="flex flex-1 items-center gap-1.5 text-[12px] text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <span className="font-medium text-zinc-300">{SORT_OPTIONS.find((s) => s.id === sortBy)?.label}</span>
          <ChevronRight size={12} className="rotate-90 text-zinc-600" />
        </button>

        {!loading && (
          <span className="text-[11px] text-zinc-700">
            {listings.length} {listings.length === 1 ? t("listings_results_one") : t("listings_results_many")}
          </span>
        )}

        {/* Filter button */}
        <button
          onClick={() => setFilterOpen(true)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all",
            filterCount > 0
              ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
              : "border-white/8 bg-zinc-900 text-zinc-400 hover:border-white/15 hover:text-zinc-200"
          )}
        >
          <SlidersHorizontal size={12} />
          {t("listings_filters")}
          {filterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[9px] font-bold text-zinc-950">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Sort sheet ── */}
      <AnimatePresence>
        {sortOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60"
              onClick={() => setSortOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-zinc-950 px-4 pb-10 pt-5"
            >
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-zinc-700" />
              <p className="mb-4 text-[13px] font-semibold uppercase tracking-widest text-zinc-500">{t("listings_sort")}</p>
              <div className="space-y-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setSortBy(opt.id); setSortOpen(false); }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] transition-all",
                      sortBy === opt.id
                        ? "bg-amber-400/10 font-semibold text-amber-400"
                        : "text-zinc-200 hover:bg-zinc-900"
                    )}
                  >
                    {opt.label}
                    {sortBy === opt.id && (
                      <CheckCircle size={16} className="text-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      {loading ? (
        viewMode === "list" ? <SkeletonList /> : <SkeletonGrid />
      ) : listings.length === 0 ? (
        <EmptyState onClear={() => {
          setSearch("");
          setFilters(DEFAULT_FILTERS);
        }} />
      ) : (
        <div className="space-y-6 pt-4 pb-4">

          {/* Available Now strip */}
          {liveNow.length > 0 && (
            <section>
              <div className="flex items-center gap-2 px-4 pb-2.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  {t("listings_available_now")} · {liveNow.length}
                </p>
              </div>
              <div
                className="flex gap-3 overflow-x-auto px-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {liveNow.slice(0, 10).map((l) => <LiveStripCard key={l.id} listing={l} />)}
                <div className="w-2 flex-shrink-0" />
              </div>
            </section>
          )}

          {/* New Today strip — only when on "Newest" sort and no search */}
          {newToday.length > 0 && sortBy === "newest" && !search && (
            <section>
              <div className="flex items-center gap-2 px-4 pb-2.5">
                <Zap size={12} className="text-amber-400" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  {t("listings_new_today")} · {newToday.length}
                </p>
              </div>
              <div
                className="flex gap-3 overflow-x-auto px-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {newToday.slice(0, 8).map((l) => <NewTodayCard key={l.id} listing={l} />)}
                <div className="w-2 flex-shrink-0" />
              </div>
            </section>
          )}

          {/* Main content */}
          <section className="px-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-700">
              {category === "all" ? t("listings_all_listings") : category}
              {search && <span className="ml-1 normal-case text-zinc-600">"{search}"</span>}
            </p>

            {viewMode === "list" ? (
              <div className="space-y-2.5">
                {listings.map((listing, i) => (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.025, 0.3) }}
                  >
                    <ListingRow listing={listing} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {listings.map((listing, i) => (
                  <motion.div
                    key={listing.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.4) }}
                  >
                    <ListingGridCard listing={listing} />
                  </motion.div>
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
              </div>
            )}
            {!hasMore && listings.length > 0 && (
              <p className="py-6 text-center text-[12px] text-zinc-700">
                All listings loaded
              </p>
            )}
          </section>
        </div>
      )}

      {/* Filter drawer */}
      <AnimatePresence>
        {filterOpen && (
          <ListingsFilterDrawer
            filters={filters}
            onApply={(f) => { setFilters(f); setFilterOpen(false); }}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Live strip card (horizontal scroll) ─────────────────────────────────────

function LiveStripCard({ listing }: { listing: ListingCard }) {
  const img = listing.cover_url ?? listing.provider.avatar_url;
  const isVerified = listing.provider.verification_status === "verified";

  return (
    <Link href={`/listings/${listing.id}`} className="group flex-shrink-0">
      <div className="relative h-48 w-32 overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-1">
        {img ? (
          <Image src={img} alt={listing.title} fill
            className="object-cover transition duration-500 group-hover:scale-105" sizes="128px" />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800">
            <span className="text-2xl font-bold text-zinc-600">{listing.provider.username[0].toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-emerald-500/20 transition group-hover:ring-emerald-500/40" />

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-emerald-500/40 bg-black/70 px-2 py-0.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-400">LIVE</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
          <div className="rounded-xl border border-white/10 bg-black/70 px-2.5 py-2 backdrop-blur-md">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="truncate text-[10px] font-bold text-white">{listing.provider.username}</span>
              {isVerified && <CheckCircle size={8} className="flex-shrink-0 text-amber-400" />}
            </div>
            <p className="line-clamp-1 text-[9px] text-zinc-400">{listing.title}</p>
            <p className="mt-0.5 text-[9px] font-bold text-amber-400">
              {formatRate(listing.rate, listing.duration_minutes)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── New Today card (horizontal scroll) ──────────────────────────────────────

function NewTodayCard({ listing }: { listing: ListingCard }) {
  const img = listing.cover_url ?? listing.provider.avatar_url;
  const isVerified = listing.provider.verification_status === "verified";

  return (
    <Link href={`/listings/${listing.id}`} className="group flex-shrink-0">
      <div className="relative h-44 w-28 overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-1">
        {img ? (
          <Image src={img} alt={listing.title} fill
            className="object-cover transition duration-500 group-hover:scale-105" sizes="112px" />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800">
            <span className="text-xl font-bold text-zinc-600">{listing.provider.username[0].toUpperCase()}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
        <div className="absolute inset-0 rounded-2xl ring-1 ring-white/8" />

        <div className="absolute right-2 top-2 rounded-full bg-amber-400 px-2 py-0.5">
          <span className="text-[8px] font-black text-zinc-950">NEW</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 px-2 pb-2">
          <div className="flex items-center gap-1">
            <span className="truncate text-[10px] font-bold text-white">{listing.provider.username}</span>
            {isVerified && <CheckCircle size={8} className="flex-shrink-0 text-amber-400" />}
          </div>
          <p className="line-clamp-1 text-[8px] text-zinc-400 mt-0.5">{listing.title}</p>
          <p className="mt-0.5 text-[9px] font-bold text-amber-300">{formatRate(listing.rate, listing.duration_minutes)}</p>
        </div>
      </div>
    </Link>
  );
}

// ─── List view row ────────────────────────────────────────────────────────────

function ListingRow({ listing }: { listing: ListingCard }) {
  const img = listing.cover_url ?? listing.provider.avatar_url;
  const isVerified = listing.provider.verification_status === "verified";
  const live = isAvailableNow(listing.provider.available_until);
  const isNew = isNewToday(listing.created_at);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex items-stretch gap-3 rounded-2xl border border-white/5 bg-zinc-900 p-3 transition-all duration-200 hover:border-white/10 hover:bg-zinc-900/80 active:scale-[0.99]"
    >
      {/* Thumbnail */}
      <div className="relative h-[88px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl bg-zinc-800">
        {img ? (
          <Image src={img} alt={listing.title} fill
            className="object-cover transition duration-300 group-hover:scale-105" sizes="72px" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-xl font-bold text-zinc-600">{listing.provider.username[0].toUpperCase()}</span>
          </div>
        )}
        {live && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-emerald-500/90 py-0.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
            <span className="text-[7px] font-bold text-white">LIVE</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col justify-between min-w-0">
        <div>
          {/* Title */}
          <p className="line-clamp-1 text-[14px] font-semibold text-white leading-snug">
            {listing.title}
          </p>

          {/* Provider + verified + city */}
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] text-zinc-400">@{listing.provider.username}</span>
            {isVerified && <CheckCircle size={11} className="text-amber-400 flex-shrink-0" />}
            {listing.provider.city && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="flex items-center gap-0.5 text-[11px] text-zinc-500">
                  <MapPin size={9} />
                  {listing.provider.city}
                </span>
              </>
            )}
            {listing.provider.age && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-[11px] text-zinc-500">{listing.provider.age} yrs</span>
              </>
            )}
          </div>
        </div>

        <div>
          {/* Rate */}
          <p className="text-[14px] font-bold text-amber-400 leading-none">
            {formatRate(listing.rate, listing.duration_minutes)}
          </p>

          {/* Bottom row: chips + time */}
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {listing.provider.incall && (
              <span className="rounded-full border border-white/8 bg-zinc-800 px-2 py-0.5 text-[9px] font-medium text-zinc-500">
                In-call
              </span>
            )}
            {listing.provider.outcall && (
              <span className="rounded-full border border-white/8 bg-zinc-800 px-2 py-0.5 text-[9px] font-medium text-zinc-500">
                Out-call
              </span>
            )}
            {isNew && !live && (
              <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold text-amber-400">
                NEW
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5 text-[10px] text-zinc-700">
              <Clock size={9} />
              {timeAgo(listing.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Chevron */}
      <div className="flex items-center self-center">
        <ChevronRight size={15} className="text-zinc-700 transition-colors group-hover:text-zinc-500" />
      </div>
    </Link>
  );
}

// ─── Grid view card ───────────────────────────────────────────────────────────

function ListingGridCard({ listing }: { listing: ListingCard }) {
  const img = listing.cover_url ?? listing.provider.avatar_url;
  const isVerified = listing.provider.verification_status === "verified";
  const live = isAvailableNow(listing.provider.available_until);
  const isNew = isNewToday(listing.created_at);

  return (
    <Link href={`/listings/${listing.id}`} className="group block">
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900 transition-all duration-300 group-hover:border-white/10 group-hover:shadow-xl group-hover:shadow-black/50 active:scale-[0.98]">
        <div className="relative aspect-[3/4] bg-zinc-800">
          {img ? (
            <Image src={img} alt={listing.title} fill
              className="object-cover transition duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 200px" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-3xl font-bold text-zinc-600">{listing.provider.username[0].toUpperCase()}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />

          <div className="absolute left-2 right-2 top-2.5 flex items-center justify-between">
            {live ? (
              <div className="flex items-center gap-1 rounded-full border border-emerald-500/40 bg-black/70 px-2 py-0.5 backdrop-blur-sm">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-[8px] font-bold text-emerald-400">LIVE</span>
              </div>
            ) : isNew ? (
              <div className="rounded-full bg-amber-400 px-2 py-0.5">
                <span className="text-[8px] font-black text-zinc-950">NEW</span>
              </div>
            ) : <div />}

            {isVerified && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-black/70 backdrop-blur-sm">
                <CheckCircle size={11} className="text-amber-400" />
              </div>
            )}
          </div>
        </div>

        <div className="px-3 py-2.5">
          <p className="line-clamp-1 text-[13px] font-semibold text-white">{listing.title}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-[11px] text-zinc-500">@{listing.provider.username}</span>
            {listing.provider.city && (
              <span className="text-[10px] text-zinc-700 truncate">· {listing.provider.city}</span>
            )}
          </div>
          <div className="my-2 h-px bg-white/5" />
          <p className="text-[13px] font-bold text-amber-400">
            {formatRate(listing.rate, listing.duration_minutes)}
          </p>
          <div className="mt-1.5 flex items-center gap-1">
            {listing.provider.incall && (
              <span className="rounded-full border border-white/8 bg-zinc-800 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500">In-call</span>
            )}
            {listing.provider.outcall && (
              <span className="rounded-full border border-white/8 bg-zinc-800 px-1.5 py-0.5 text-[8px] font-medium text-zinc-500">Out-call</span>
            )}
            <span className="ml-auto text-[9px] text-zinc-700">{timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onClear }: { onClear?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 pt-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
        <Search size={26} className="text-zinc-700" />
      </div>
      <p className="text-[15px] font-semibold text-zinc-300">{t("listings_empty")}</p>
      <p className="text-[13px] leading-relaxed text-zinc-600">{t("listings_empty_body")}</p>
      {onClear && (
        <button
          onClick={onClear}
          className="mt-2 rounded-full border border-white/10 px-5 py-2 text-[13px] font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <div className="space-y-2.5 px-4 pt-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-white/5 bg-zinc-900 p-3 animate-pulse">
          <div className="h-[88px] w-[72px] flex-shrink-0 rounded-xl bg-zinc-800" />
          <div className="flex flex-1 flex-col justify-between py-1">
            <div className="space-y-2">
              <div className="h-3.5 w-3/4 rounded-full bg-zinc-800" />
              <div className="h-2.5 w-1/2 rounded-full bg-zinc-800/60" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3.5 w-1/3 rounded-full bg-zinc-800" />
              <div className="flex gap-1.5">
                <div className="h-2.5 w-12 rounded-full bg-zinc-800/50" />
                <div className="h-2.5 w-14 rounded-full bg-zinc-800/50" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
          <div className="aspect-[3/4] bg-zinc-800" />
          <div className="space-y-2 px-3 py-2.5">
            <div className="h-3 w-3/4 rounded-full bg-zinc-800" />
            <div className="h-2.5 w-1/2 rounded-full bg-zinc-800/60" />
            <div className="h-3 w-2/3 rounded-full bg-zinc-800/40" />
          </div>
        </div>
      ))}
    </div>
  );
}
