"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, SlidersHorizontal, CheckCircle, ArrowUpDown, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FilterDrawer, DEFAULT_FILTERS, type Filters } from "./FilterDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderCard = {
  id: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null; // latest post media_url
  verification_status: "none" | "pending" | "verified";
  city: string | null;
  country_code: string | null;
  age: number | null;
  hourly_rate: number | null;
  available_until: string | null;
  incall: boolean;
  outcall: boolean;
  service_categories: string[];
};

type SortBy = "newest" | "popular" | "rate_asc" | "rate_desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { id: "all",          label: "All" },
  { id: "available",    label: "Available Now" },
  { id: "Companionship",label: "Companionship" },
  { id: "Dinner Date",  label: "Dinner Date" },
  { id: "Travel",       label: "Travel" },
  { id: "GFE",          label: "GFE" },
  { id: "Couples",      label: "Couples" },
  { id: "Massage",      label: "Massage" },
  { id: "Domination",   label: "Domination" },
];

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "newest",    label: "Newest" },
  { id: "popular",   label: "Popular" },
  { id: "rate_asc",  label: "Rate ↑" },
  { id: "rate_desc", label: "Rate ↓" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRate(pence: number | null): string {
  if (!pence) return "";
  return `CA$${Math.round(pence / 100)}/hr`;
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreClient() {
  const [cityQuery, setCityQuery]   = useState("");
  const [filters, setFilters]       = useState<Filters>(DEFAULT_FILTERS);
  const [sortBy, setSortBy]         = useState<SortBy>("newest");
  const [quickFilter, setQuickFilter] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [results, setResults]       = useState<ProviderCard[]>([]);
  const [loading, setLoading]       = useState(true);
  const [geoLoading, setGeoLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (city: string, f: Filters, sort: SortBy) => {
    setLoading(true);

    let query = supabase
      .from("profiles")
      .select("id, username, avatar_url, verification_status, city, country_code, age, hourly_rate, available_until, incall, outcall, service_categories")
      .eq("is_provider", true)
      .limit(40);

    if (city.trim())       query = query.ilike("city", `%${city.trim()}%`);
    if (f.verifiedOnly)    query = query.eq("verification_status", "verified");
    if (f.availableNow)    query = query.gt("available_until", new Date().toISOString());
    if (f.incall && !f.outcall)  query = query.eq("incall", true);
    else if (f.outcall && !f.incall) query = query.eq("outcall", true);
    if (f.categories.length > 0) query = query.overlaps("service_categories", f.categories);
    if (f.minRate > 0)     query = query.gte("hourly_rate", f.minRate * 100);
    if (f.maxRate < DEFAULT_FILTERS.maxRate) query = query.lte("hourly_rate", f.maxRate * 100);
    if (f.minAge > DEFAULT_FILTERS.minAge)   query = query.gte("age", f.minAge);
    if (f.maxAge < DEFAULT_FILTERS.maxAge)   query = query.lte("age", f.maxAge);

    switch (sort) {
      case "rate_asc":  query = query.order("hourly_rate", { ascending: true,  nullsFirst: false }); break;
      case "rate_desc": query = query.order("hourly_rate", { ascending: false, nullsFirst: false }); break;
      case "popular":   query = query.order("followers_count", { ascending: false }); break;
      default:          query = query.order("created_at", { ascending: false });
    }

    const { data } = await query;
    const providers = (data ?? []) as (ProviderCard & { cover_url?: string | null })[];

    // Fetch latest post cover image per provider (second lightweight query)
    const providerIds = providers.map((p) => p.id);
    let coverMap = new Map<string, string>();
    if (providerIds.length > 0) {
      const { data: coverData } = await supabase
        .from("status_updates")
        .select("provider_id, media_url")
        .in("provider_id", providerIds)
        .not("media_url", "is", null)
        .order("created_at", { ascending: false });

      for (const row of coverData ?? []) {
        const r = row as { provider_id: string; media_url: string };
        if (!coverMap.has(r.provider_id)) coverMap.set(r.provider_id, r.media_url);
      }
    }

    setResults(providers.map((p) => ({ ...p, cover_url: coverMap.get(p.id) ?? null })));
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => { fetchResults("", DEFAULT_FILTERS, "newest"); }, [fetchResults]);

  // Debounced re-fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchResults(cityQuery, filters, sortBy), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, filters, sortBy, fetchResults]);

  // Near me
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
        } catch {}
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  }

  // Quick filter chip handler
  function handleQuickFilter(id: string) {
    setQuickFilter(id);
    if (id === "all") {
      setFilters((f) => ({ ...f, availableNow: false, categories: [] }));
    } else if (id === "available") {
      setFilters((f) => ({ ...f, availableNow: true, categories: [] }));
    } else {
      setFilters((f) => ({ ...f, availableNow: false, categories: [id] }));
    }
  }

  function removeFilter(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    if (patch.availableNow === false || patch.categories?.length === 0) setQuickFilter("all");
  }

  function cycleSortBy() {
    const options: SortBy[] = ["newest", "popular", "rate_asc", "rate_desc"];
    setSortBy((cur) => options[(options.indexOf(cur) + 1) % options.length]);
  }

  const activeCount = countActiveFilters(filters);
  const availableNow = results.filter((p) => isAvailableNow(p.available_until));
  const locationLabel = cityQuery.trim() ? `in ${cityQuery.trim()}` : "· All cities";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black pb-24 animate-[fadeIn_0.4s_ease-out]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/70 px-4 py-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-center">
          <span className="text-2xl font-semibold tracking-tight text-amber-400">Explore</span>
        </div>
      </header>

      {/* ── Search bar ── */}
      <div className="space-y-3 px-4 pb-2 pt-4">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by city…"
            value={cityQuery}
            onChange={(e) => setCityQuery(e.target.value)}
            className="w-full rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 py-3 pl-9 pr-4 text-[14px] text-zinc-100 placeholder-zinc-600 outline-none transition-all focus:border-amber-400/30 focus:ring-1 focus:ring-amber-400/20"
          />
          {cityQuery && (
            <button onClick={() => setCityQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">×</button>
          )}
        </div>

        {/* Near me + Sort + Filters row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNearMe}
            disabled={geoLoading}
            className="flex items-center gap-1.5 rounded-full border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 px-3.5 py-2 text-[12px] font-medium text-zinc-400 transition-all hover:border-amber-400/30 hover:text-amber-400 disabled:opacity-40"
          >
            <MapPin size={13} />
            {geoLoading ? "Locating…" : "Near me"}
          </button>

          {/* Sort — cycles through options on tap */}
          <button
            onClick={cycleSortBy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 px-3.5 py-2 text-[12px] font-medium text-zinc-400 transition-all hover:border-white/10 hover:text-zinc-200"
          >
            <ArrowUpDown size={13} />
            {SORT_OPTIONS.find((s) => s.id === sortBy)?.label}
          </button>

          <button
            onClick={() => setDrawerOpen(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[12px] font-medium transition-all",
              activeCount > 0
                ? "border-amber-400/40 bg-amber-400/10 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                : "border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 text-zinc-400 hover:border-white/10 hover:text-zinc-200"
            )}
          >
            <SlidersHorizontal size={13} />
            Filters
            {activeCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-950">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {/* Active drawer filter chips */}
        {activeCount > 0 && quickFilter === "all" && (
          <div className="flex flex-wrap gap-2">
            {filters.verifiedOnly && <Chip label="Verified" onRemove={() => removeFilter({ verifiedOnly: false })} />}
            {filters.incall && <Chip label="In-call" onRemove={() => removeFilter({ incall: false })} />}
            {filters.outcall && <Chip label="Out-call" onRemove={() => removeFilter({ outcall: false })} />}
          </div>
        )}
      </div>

      {/* ── Quick-filter category chips ── */}
      <div
        className="flex gap-2 overflow-x-auto py-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", paddingLeft: "1rem", paddingRight: "1rem" }}
      >
        {QUICK_FILTERS.map((qf) => {
          const active = quickFilter === qf.id;
          return (
            <button
              key={qf.id}
              onClick={() => handleQuickFilter(qf.id)}
              className={cn(
                "flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all",
                active
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                  : "border-white/5 bg-zinc-900 text-zinc-400 hover:border-white/10 hover:text-zinc-300"
              )}
            >
              {qf.id === "available" && (
                <span className={cn("mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle", active ? "bg-emerald-400" : "bg-zinc-600")} />
              )}
              {qf.label}
            </button>
          );
        })}
        {/* Right-side padding spacer — fixes overflow-x-auto clipping */}
        <div className="w-2 flex-shrink-0" />
      </div>

      {/* ── Result count ── */}
      {!loading && results.length > 0 && (
        <p className="px-4 pb-2 pt-1 text-[12px] text-zinc-600">
          <span className="font-medium text-zinc-400">{results.length}</span>
          {" "}provider{results.length !== 1 ? "s" : ""} {locationLabel}
        </p>
      )}

      {loading ? (
        <SkeletonGrid />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-4 pt-20">
          <Search size={32} className="text-zinc-700" />
          <p className="text-[15px] font-medium text-zinc-400">No providers found</p>
          <p className="text-center text-[13px] text-zinc-600">Try a different city or adjust your filters</p>
        </div>
      ) : (
        <>
          {/* ── Available Now strip ── */}
          {availableNow.length > 0 && quickFilter !== "available" && (
            <div className="mb-4">
              <div className="flex items-center gap-2 px-4 pb-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Available Now
                </p>
              </div>
              <div
                className="flex gap-3 overflow-x-auto px-4"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {availableNow.map((provider) => (
                  <AvailableCard key={provider.id} provider={provider} />
                ))}
              </div>
            </div>
          )}

          {/* ── Main grid ── */}
          <div className="grid grid-cols-2 gap-3 px-3">
            {results.map((provider, i) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
              >
                <ProviderCard provider={provider} />
              </motion.div>
            ))}
          </div>
        </>
      )}

      <AnimatePresence>
        {drawerOpen && (
          <FilterDrawer
            filters={filters}
            onApply={(f) => { setFilters(f); setDrawerOpen(false); setQuickFilter("all"); }}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Available Now strip card ─────────────────────────────────────────────────

function AvailableCard({ provider }: { provider: ProviderCard }) {
  const coverSrc = provider.cover_url ?? provider.avatar_url;
  const isVerified = provider.verification_status === "verified";

  return (
    <Link href={`/u/${provider.username}`} className="group flex-shrink-0">
      <div className="relative w-36 h-52 rounded-3xl overflow-hidden shadow-lg transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-emerald-500/20 group-hover:shadow-2xl">

        {/* Image */}
        {coverSrc ? (
          <Image
            src={coverSrc}
            alt={provider.username}
            fill
            className="object-cover transition duration-700 group-hover:scale-110"
            sizes="144px"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-zinc-800">
            <span className="text-3xl text-zinc-500 font-bold">
              {provider.username[0].toUpperCase()}
            </span>
          </div>
        )}

        {/* Cinematic gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

        {/* Border ring */}
        <div className="absolute inset-0 rounded-3xl ring-1 ring-white/10 group-hover:ring-emerald-400/40 transition-all duration-300" />

        {/* LIVE badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-500/30">
          <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_#34d399]" />
          <span className="text-[9px] text-emerald-400 font-bold tracking-wide">LIVE</span>
        </div>

        {/* Bottom info — glass strip */}
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-white text-[12px] font-bold truncate">{provider.username}</span>
              {isVerified && <CheckCircle size={10} className="flex-shrink-0 text-amber-400" />}
            </div>
            {provider.hourly_rate ? (
              <span className="text-emerald-400 text-[10px] font-semibold">{formatRate(provider.hourly_rate)}</span>
            ) : provider.city ? (
              <div className="flex items-center gap-0.5">
                <MapPin size={9} className="text-zinc-500" />
                <span className="text-zinc-400 text-[10px] truncate">{provider.city}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Main grid card ───────────────────────────────────────────────────────────

function ProviderCard({ provider }: { provider: ProviderCard }) {
  const available = isAvailableNow(provider.available_until);
  const isVerified = provider.verification_status === "verified";
  const coverSrc = provider.cover_url ?? provider.avatar_url;

  return (
    <Link href={`/u/${provider.username}`} className="group block">
      <div className="relative overflow-hidden rounded-3xl shadow-md transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-2xl group-hover:shadow-black/60">

        {/* Image */}
        <div className="relative aspect-[3/4] bg-zinc-900">
          {coverSrc ? (
            <Image
              src={coverSrc}
              alt={provider.username}
              fill
              className="object-cover transition duration-700 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 200px"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-800">
              <span className="text-4xl text-zinc-500 font-bold">
                {provider.username[0].toUpperCase()}
              </span>
            </div>
          )}

          {/* Deep cinematic gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          {/* Top badges row */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            {available ? (
              <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-emerald-500/30">
                <span className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_6px_#34d399]" />
                <span className="text-[9px] text-emerald-400 font-bold tracking-wide">LIVE</span>
              </div>
            ) : <div />}

            {provider.hourly_rate && (
              <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                <span className="text-[11px] font-bold text-white">{formatRate(provider.hourly_rate)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Glass info panel — sits below image, not overlaid */}
        <div className="bg-zinc-900/95 backdrop-blur-xl border-t border-white/5 px-3.5 pt-3 pb-3">

          {/* Name + verified */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-white text-[13px] font-bold truncate">{provider.username}</span>
            {isVerified && <CheckCircle size={11} className="flex-shrink-0 text-amber-400" />}
          </div>

          {/* City */}
          {provider.city && (
            <div className="flex items-center gap-1 mb-2.5">
              <MapPin size={9} className="text-zinc-500 flex-shrink-0" />
              <span className="text-zinc-500 text-[10px] truncate">{provider.city}</span>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-white/5 mb-2" />

          {/* Service tags */}
          <div className="flex items-center gap-1.5">
            {provider.incall && (
              <span className="text-[9px] font-medium text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5 border border-white/5">In-call</span>
            )}
            {provider.outcall && (
              <span className="text-[9px] font-medium text-zinc-400 bg-zinc-800 rounded-full px-2 py-0.5 border border-white/5">Out-call</span>
            )}
            {provider.age && (
              <span className="ml-auto text-[9px] text-zinc-500">{provider.age} yrs</span>
            )}
          </div>
        </div>

        {/* Hover light sweep */}
        <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-gradient-to-tr from-white/5 via-transparent to-transparent" />
      </div>
    </Link>
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-white/5 bg-gradient-to-b from-zinc-800 to-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-300">
      {label}
      <button onClick={onRemove} className="text-zinc-500 hover:text-zinc-200">×</button>
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 px-3 pt-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
          <div className="aspect-[3/4] bg-zinc-800" />
          <div className="space-y-1.5 px-2.5 py-2">
            <div className="h-3 w-20 rounded-full bg-zinc-800" />
            <div className="h-2 w-14 rounded-full bg-zinc-800/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
