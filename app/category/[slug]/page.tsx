"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft, Search, MapPin, SlidersHorizontal,
  X, Loader2, ChevronDown, Navigation, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategoryBySlug, CATEGORIES } from "@/lib/categories";
import type { Category } from "@/lib/categories";
import { supabase } from "@/lib/supabase/client";
import { cacheKey, cacheGet, cacheSet } from "@/lib/cache";
import { ProviderCard } from "@/components/ui/ProviderCard";
import type { ProviderCardData } from "@/components/ui/ProviderCard";
import { BottomNav } from "@/components/ui/BottomNav";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;
const PINK = "#ec4899";

const RADIUS_OPTIONS = [
  { label: "5 km", value: 5 },
  { label: "10 km", value: 10 },
  { label: "25 km", value: 25 },
  { label: "50 km", value: 50 },
  { label: "Any distance", value: 0 },
];

const SORT_OPTIONS = [
  { label: "Recently active", value: "recent" },
  { label: "Newest members", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type RPCProvider = ProviderCardData & {
  distance_km: number | null;
  total_count: number;
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const category = getCategoryBySlug(slug);

  const [providers, setProviders] = useState<RPCProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [radiusKm, setRadiusKm] = useState(50);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ── Fetch via RPC ──
  const fetchProviders = useCallback(async (
    cat: Category,
    opts: {
      cursor?: string | null;
      append?: boolean;
      search?: string;
      city?: string;
      sort?: string;
      lat?: number | null;
      lng?: number | null;
      radius?: number;
    } = {}
  ) => {
    const { cursor = null, append = false, search, city, sort = "recent", lat, lng, radius = 50 } = opts;

    if (!append) setLoading(true);
    else setLoadingMore(true);

    const rpcParams = {
      p_filter_type: cat.filter.type,
      p_filter_value: String(cat.filter.value),
      p_search_query: search?.trim() || null,
      p_city: city?.trim() || null,
      p_lat: lat ?? null,
      p_lng: lng ?? null,
      p_radius_km: radius || 50,
      p_sort: sort,
      p_limit: PAGE_SIZE,
      p_cursor: cursor ?? null,
    };

    const key = cacheKey("cat", rpcParams);
    const cached = !append ? cacheGet<RPCProvider[]>(key) : null;

    let results: RPCProvider[];
    if (cached) {
      results = cached;
    } else {
      const { data, error } = await supabase.rpc("search_category_providers", rpcParams);

      if (error) {
        console.error("Category RPC error:", error.message);
        if (!append) {
          setProviders([]);
          setTotalCount(0);
        }
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      results = (data ?? []) as RPCProvider[];

      if (!append) {
        cacheSet(key, results);
      }
    }

    if (results.length > 0) {
      setTotalCount(results[0].total_count);
    } else if (!append) {
      setTotalCount(0);
    }

    if (append) {
      setProviders((prev) => [...prev, ...results]);
    } else {
      setProviders(results);
    }

    setHasMore(results.length >= PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, []);

  // ── Initial load + filter changes ──
  useEffect(() => {
    if (!category) return;
    fetchProviders(category, {
      search: searchQuery,
      city: cityQuery,
      sort: sortBy,
      lat: userLat,
      lng: userLng,
      radius: radiusKm,
    });
  }, [category, cityQuery, sortBy, userLat, userLng, radiusKm, fetchProviders]);

  // ── Debounced search ──
  useEffect(() => {
    if (!category) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchProviders(category, {
        search: searchQuery,
        city: cityQuery,
        sort: sortBy,
        lat: userLat,
        lng: userLng,
        radius: radiusKm,
      });
    }, 350);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // ── Infinite scroll observer ──
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && category) {
          setLoadingMore(true);
          supabase.rpc("search_category_providers", {
            p_filter_type: category.filter.type,
            p_filter_value: String(category.filter.value),
            p_search_query: searchQuery.trim() || null,
            p_city: cityQuery.trim() || null,
            p_lat: userLat,
            p_lng: userLng,
            p_radius_km: radiusKm || 50,
            p_sort: sortBy,
            p_limit: PAGE_SIZE,
            p_cursor: null,
          }).then(({ data }) => {
            const existingIds = new Set(providers.map((p) => p.id));
            const newResults = ((data ?? []) as RPCProvider[]).filter((p) => !existingIds.has(p.id));

            if (newResults.length === 0) {
              setHasMore(false);
            } else {
              setProviders((prev) => [...prev, ...newResults]);
            }
            setLoadingMore(false);
          });
        }
      },
      { rootMargin: "200px" }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadingMore, category, providers, searchQuery, cityQuery, userLat, userLng, radiusKm, sortBy]);

  // ── Geolocation ──
  async function handleNearMe() {
    if (!navigator.geolocation) return;
    setGeoLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLat(latitude);
        setUserLng(longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || "";
          if (city) setCityQuery(city);
        } catch { /* ignore */ }
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 }
    );
  }

  function clearGeo() {
    setCityQuery("");
    setUserLat(null);
    setUserLng(null);
  }

  // ── Not found ──
  if (!category) {
    return (
      <div className="min-h-screen bg-[#fafbfc] pb-24">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
          <button onClick={() => router.back()} className="text-slate-500 hover:text-slate-800 transition">
            <ArrowLeft size={20} />
          </button>
          <span className="text-[15px] font-semibold text-slate-800">Category not found</span>
        </header>
        <EmptyState variant="no-results" />
        <BottomNav />
      </div>
    );
  }

  const currentSort = SORT_OPTIONS.find((s) => s.value === sortBy);
  const currentRadius = RADIUS_OPTIONS.find((r) => r.value === radiusKm);
  const isGeoActive = userLat !== null && userLng !== null;
  const relatedCategories = CATEGORIES.filter((c) => c.slug !== slug).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">

      {/* ══════════════════════════════════════════════════════════════════════
          HERO — dark, minimal, no colored gradients
          ════════════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-white">
        {/* Ambient glow behind emoji */}
        <div
          className="pointer-events-none absolute -top-16 right-4 h-40 w-40 rounded-full blur-[70px] opacity-[0.07]"
          style={{ background: PINK }}
        />

        {/* Back button */}
        <header className="relative z-10 flex items-center gap-3 px-4 pt-4 pb-1">
          <button
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-slate-500 backdrop-blur-md transition-all hover:border-gray-300 hover:text-slate-800 active:scale-95"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Link href="/categories" className="hover:text-slate-500 transition-colors">Categories</Link>
            <ChevronRight size={10} />
            <span className="text-slate-500">{category.shortLabel}</span>
          </div>
        </header>

        <div className="relative z-10 px-5 pb-6 pt-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-800">
                {category.label}
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500 max-w-[280px]">
                {category.description}
              </p>
              {!loading && (
                <p className="mt-3 text-[12px] font-medium text-slate-400">
                  <span className="text-pink-500">{totalCount}</span>{" "}
                  {totalCount === 1 ? "provider" : "providers"}
                  {cityQuery && (
                    <span className="text-slate-400"> near <span className="text-slate-500">{cityQuery}</span></span>
                  )}
                </p>
              )}
            </div>
            <span className="text-4xl opacity-40 mt-1 flex-shrink-0">{category.emoji}</span>
          </div>
        </div>

        {/* Gold accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          CONTROLS — sticky search, sort, radius, related
          ════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-20 bg-[#fafbfc]/95 backdrop-blur-xl">
        {/* Search row */}
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Near me */}
          <button
            onClick={isGeoActive ? clearGeo : handleNearMe}
            disabled={geoLoading}
            className={cn(
              "flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[12px] font-medium transition-all disabled:opacity-40",
              isGeoActive
                ? "border-pink-300 bg-pink-50 text-pink-500"
                : "border-gray-200 bg-white text-slate-500 hover:border-pink-200 hover:text-pink-500"
            )}
          >
            {isGeoActive ? <Navigation size={12} className="fill-pink-500" /> : <MapPin size={13} />}
            {geoLoading ? "..." : cityQuery || "Near me"}
            {isGeoActive && (
              <span
                role="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearGeo(); }}
                className="ml-0.5 text-pink-400 hover:text-pink-500"
              >
                <X size={11} />
              </span>
            )}
          </button>

          {/* Search input */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-full border border-gray-200 bg-white py-2 pl-8 pr-7 text-[13px] text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-pink-300 focus:ring-1 focus:ring-pink-200"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Pills row: sort, radius, related */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 scrollbar-hide">
          {/* Sort dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => { setSortOpen(!sortOpen); setRadiusOpen(false); }}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-all hover:border-gray-300 hover:text-slate-600"
            >
              <SlidersHorizontal size={11} />
              {currentSort?.label}
              <ChevronDown size={10} className={cn("transition-transform", sortOpen && "rotate-180")} />
            </button>

            {sortOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setSortOpen(false)} />
                <div className="absolute left-0 top-full z-40 mt-1.5 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-slate-200/60">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setSortOpen(false); }}
                      className={cn(
                        "flex w-full px-4 py-2.5 text-[12px] transition-colors",
                        sortBy === opt.value
                          ? "bg-pink-50 text-pink-500 font-semibold"
                          : "text-slate-500 hover:bg-gray-50 hover:text-slate-600"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Radius dropdown */}
          {isGeoActive && (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setRadiusOpen(!radiusOpen); setSortOpen(false); }}
                className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-[11px] font-medium text-pink-500 transition-all hover:bg-pink-100"
              >
                <Navigation size={10} className="fill-pink-500" />
                {currentRadius?.label}
                <ChevronDown size={10} className={cn("transition-transform", radiusOpen && "rotate-180")} />
              </button>

              {radiusOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setRadiusOpen(false)} />
                  <div className="absolute left-0 top-full z-40 mt-1.5 w-40 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl shadow-slate-200/60">
                    {RADIUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setRadiusKm(opt.value); setRadiusOpen(false); }}
                        className={cn(
                          "flex w-full px-4 py-2.5 text-[12px] transition-colors",
                          radiusKm === opt.value
                            ? "bg-pink-50 text-pink-500 font-semibold"
                            : "text-slate-500 hover:bg-gray-50 hover:text-slate-600"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Divider dot */}
          {relatedCategories.length > 0 && (
            <div className="h-1 w-1 flex-shrink-0 rounded-full bg-gray-200" />
          )}

          {/* Related categories */}
          {relatedCategories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="flex-shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-all hover:border-gray-300 hover:text-slate-600"
            >
              {cat.shortLabel}
            </Link>
          ))}
          <div className="w-2 flex-shrink-0" />
        </div>

        {/* Bottom separator */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RESULTS GRID
          ════════════════════════════════════════════════════════════════════ */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-white shimmer" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <>
          {/* Result count */}
          <div className="px-5 pt-4 pb-1">
            <p className="text-[11px] text-slate-300">
              Showing{" "}
              <span className="font-medium text-slate-500">{providers.length}</span>
              {" "}of{" "}
              <span className="font-medium text-slate-500">{totalCount}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 pt-2">
            {providers.map((provider, i) => (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3), ease: "easeOut" }}
              >
                <ProviderCard provider={provider} />
                {/* Distance badge */}
                {provider.distance_km !== null && (
                  <div className="mt-1.5 flex items-center justify-center gap-1">
                    <MapPin size={9} className="text-slate-300" />
                    <span className="text-[10px] font-medium text-slate-400">
                      {provider.distance_km} km
                    </span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* Loading more */}
          {loadingMore && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2.5">
                <Loader2 size={16} className="animate-spin text-pink-500" />
                <span className="text-[11px] font-medium text-slate-400">Loading more</span>
              </div>
            </div>
          )}

          {/* End of results */}
          {!hasMore && providers.length > 0 && (
            <div className="py-8 text-center">
              <div className="mx-auto mb-2 h-px w-16 bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
              <p className="text-[11px] text-slate-300">
                All {totalCount} providers in this category
              </p>
            </div>
          )}
        </>
      )}

      <BottomNav />
    </div>
  );
}
