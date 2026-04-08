"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, SlidersHorizontal, CheckCircle, Plus, LayoutGrid, ChevronDown,
  X, Heart, MessageCircle, Share2, Send, MoreHorizontal, Trash2,
  Eye, TrendingUp, Users, ImagePlus, Camera, Bookmark, Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FilterDrawer, DEFAULT_FILTERS, type Filters } from "./FilterDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useProfile } from "@/contexts/ProfileContext";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";
import { useShare } from "@/hooks/useShare";
import { PostModal } from "@/components/social/PostModal";
import { StoryRingAvatar } from "@/components/ui/StoryRingAvatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { CategoriesDrawer } from "@/components/ui/CategoriesDrawer";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/ui/PullToRefresh";
import { ScrollReveal } from "@/components/ui/AmbientEffects";

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedComment = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
};

type FeedPost = {
  post_id: string;
  provider_id: string;
  provider_username: string;
  provider_avatar: string | null;
  provider_verified: string;
  provider_city: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string;
  post_type: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
  created_at: string;
  latest_comments: FeedComment[];
  is_promoted?: boolean;  // set client-side during interleaving, not from DB
};

type StoryGroup = {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
  age: number | null;
  city: string | null;
  latest_story_at: string;
  story_count: number;
  has_unseen: boolean;
  stories: {
    id: string;
    media_url: string | null;
    media_type: string;
    caption: string | null;
    created_at: string;
    expires_at: string;
    views_count: number;
  }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_CHIPS = [
  { id: "all",           label: "All" },
  { id: "available",     label: "Available Now" },
  { id: "Companionship", label: "Companionship" },
  { id: "GFE",           label: "GFE" },
  { id: "Massage",       label: "Massage" },
  { id: "BDSM",          label: "BDSM" },
  { id: "Domination",    label: "Domination" },
  { id: "Couples",       label: "Couples" },
  { id: "Dinner Date",   label: "Dinner Date" },
  { id: "Travel",        label: "Travel" },
  { id: "420-Friendly",  label: "420-Friendly" },
  { id: "Mature",        label: "Mature" },
  { id: "Fetish",        label: "Fetish" },
  { id: "Tantric",       label: "Tantric" },
  { id: "PSE",           label: "PSE" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(date: string | null, t?: (k: import("@/lib/i18n/en").TranslationKey) => string): string {
  if (!date) return "";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return t ? t("time_just_now") : "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}${t ? t("time_m_ago") : "m ago"}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}${t ? t("time_h_ago") : "h ago"}`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}${t ? t("time_d_ago") : "d ago"}`;
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

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Provider content nudge ──────────────────────────────────────────────────

function ProviderContentNudge({ userId }: { userId: string | null }) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [nudge, setNudge] = useState<{
    type: "no-posts" | "no-recent-post" | "story-expired" | null;
  }>({ type: null });

  useEffect(() => {
    if (!userId) return;

    Promise.all([
      supabase
        .from("status_updates")
        .select("created_at")
        .eq("provider_id", userId)
        .eq("post_type", "post")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("status_updates")
        .select("expires_at")
        .eq("provider_id", userId)
        .eq("post_type", "story")
        .order("created_at", { ascending: false })
        .limit(1),
    ]).then(([postsRes, storiesRes]) => {
      const latestPost = postsRes.data?.[0];
      const latestStory = storiesRes.data?.[0];

      if (!latestPost) {
        setNudge({ type: "no-posts" });
        return;
      }

      const daysSincePost = (Date.now() - new Date(latestPost.created_at).getTime()) / 86400000;
      if (daysSincePost > 3) {
        setNudge({ type: "no-recent-post" });
        return;
      }

      if (latestStory?.expires_at && new Date(latestStory.expires_at) < new Date()) {
        setNudge({ type: "story-expired" });
        return;
      }

      setNudge({ type: null });
    });
  }, [userId]);

  if (!nudge.type || dismissed) return null;

  const config = {
    "no-posts": {
      icon: ImagePlus,
      title: t("nudge_no_posts_title"),
      desc: t("nudge_no_posts_desc"),
      cta: t("nudge_no_posts_cta"),
      href: "/profile/upload",
      color: "text-[#FCBA03]",
      bg: "bg-[#FCBA03]/8",
      border: "border-[#FCBA03]/15",
    },
    "no-recent-post": {
      icon: TrendingUp,
      title: t("nudge_stale_title"),
      desc: t("nudge_stale_desc"),
      cta: t("nudge_stale_cta"),
      href: "/profile/upload",
      color: "text-sky-400",
      bg: "bg-sky-400/8",
      border: "border-sky-400/15",
    },
    "story-expired": {
      icon: Camera,
      title: t("nudge_story_title"),
      desc: t("nudge_story_desc"),
      cta: t("nudge_story_cta"),
      href: "/profile/upload",
      color: "text-violet-400",
      bg: "bg-violet-400/8",
      border: "border-violet-400/15",
    },
  }[nudge.type];

  const Icon = config.icon;

  return (
    <div className={cn("mx-4 my-3 rounded-2xl border px-4 py-4", config.bg, config.border)}>
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl", config.bg)}>
          <Icon size={18} className={config.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <p className="text-[13px] font-semibold text-zinc-100">{config.title}</p>
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 ml-2 -mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-zinc-300"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">{config.desc}</p>
          <Link
            href={config.href}
            onClick={() => {
              if (nudge.type === "story-expired") localStorage.setItem("upload_draft_type", "story");
              else localStorage.setItem("upload_draft_type", "post");
            }}
            className={cn("mt-2.5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all active:scale-[0.97]", config.color, config.bg, "hover:brightness-125")}
          >
            {config.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Stories bar (card-style stories) ────────────────────────────────────────

function StoriesBar({
  stories,
  onStoryTap,
  isProvider,
  providerAvatar,
}: {
  stories: StoryGroup[];
  onStoryTap: (group: StoryGroup, index: number) => void;
  isProvider: boolean;
  providerAvatar: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  if (stories.length === 0 && !isProvider) return null;

  return (
    <div className="border-b border-white/5 bg-black">
      <div
        className="flex gap-4 overflow-x-auto px-4 py-3 scrollbar-hide"
      >
        {/* Create Story CTA — providers only */}
        {isProvider && (
          <button
            onClick={() => {
              localStorage.setItem("upload_draft_type", "story");
              router.push("/profile/upload");
            }}
            className="group relative flex-shrink-0 focus:outline-none"
          >
            <div className="relative h-[180px] w-[120px] overflow-hidden rounded-2xl border-2 border-dashed border-zinc-700 bg-[#141414]">
              {/* Dimmed avatar background */}
              {providerAvatar ? (
                <Image
                  src={providerAvatar}
                  alt={t("stories_your")}
                  fill
                  className="object-cover opacity-30"
                  sizes="120px"
                />
              ) : (
                <div className="absolute inset-0 bg-zinc-900" />
              )}

              {/* Center plus icon */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FCBA03] shadow-[0_0_16px_rgba(252,186,3,0.3)]">
                  <Plus size={22} strokeWidth={2.5} className="text-[#0a0a0a]" />
                </div>
                <span className="text-[11px] font-semibold text-[#FCBA03]">{t("stories_add")}</span>
              </div>
            </div>
          </button>
        )}

        {/* Story cards */}
        {stories.map((group, i) => (
          <button
            key={group.provider_id}
            onClick={() => onStoryTap(group, i)}
            className="group relative flex-shrink-0 focus:outline-none"
          >
            <div
              className={cn(
                "relative h-[180px] w-[120px] overflow-hidden rounded-2xl glow-card",
                group.has_unseen
                  ? "ring-2 ring-[#FCBA03] ring-offset-2 ring-offset-black"
                  : "ring-1 ring-white/[0.06]"
              )}
            >
              {/* Photo */}
              {group.avatar_url ? (
                <Image
                  src={group.avatar_url}
                  alt={group.username}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="120px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                  <span className="text-2xl font-bold text-zinc-500">
                    {group.username[0].toUpperCase()}
                  </span>
                </div>
              )}

              {/* Gradient overlay */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              {/* NEW badge */}
              {group.has_unseen && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#FCBA03] px-2.5 py-[2px] text-[9px] font-bold uppercase tracking-wider text-[#0a0a0a]">
                    {t("stories_new")}
                  </span>
                </div>
              )}

              {/* Bottom info */}
              <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5">
                {/* Name + age */}
                <p className="text-[12px] font-bold text-white leading-tight truncate">
                  {group.username}
                  {group.age && <span className="font-normal text-white/70">, {group.age}</span>}
                </p>

                {/* City */}
                {group.city && (
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-zinc-400 truncate">
                    {group.city}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
        <div className="w-1 flex-shrink-0" />
      </div>
    </div>
  );
}

function StoriesBarSkeleton() {
  return (
    <div className="border-b border-white/5 bg-black px-4 py-3">
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[180px] w-[120px] flex-shrink-0 rounded-2xl bg-zinc-800/60 shimmer" />
        ))}
      </div>
    </div>
  );
}

// ─── Story viewer (full-screen tap-through) ──────────────────────────────────

function StoryViewer({
  groups,
  initialGroupIndex,
  userId,
  onClose,
}: {
  groups: StoryGroup[];
  initialGroupIndex: number;
  userId: string | null;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];

  // Auto-advance timer
  useEffect(() => {
    if (!story) return;
    setProgress(0);
    const duration = 5000; // 5s per story
    const interval = 50;
    let elapsed = 0;

    // Mark as viewed
    if (userId) {
      supabase.from("story_views").upsert(
        { user_id: userId, story_id: story.id },
        { onConflict: "user_id,story_id" }
      );
    }

    timerRef.current = setInterval(() => {
      elapsed += interval;
      setProgress(Math.min(elapsed / duration, 1));
      if (elapsed >= duration) {
        advance();
      }
    }, interval);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, storyIdx]);

  function advance() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (storyIdx < group.stories.length - 1) {
      setStoryIdx(storyIdx + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }

  function goBack() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (storyIdx > 0) {
      setStoryIdx(storyIdx - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(groupIdx - 1);
      setStoryIdx(groups[groupIdx - 1].stories.length - 1);
    }
  }

  if (!group || !story) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-2 pt-3 pb-2">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-[2px] rounded-full bg-zinc-700 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-75"
              style={{
                width: i < storyIdx ? "100%" : i === storyIdx ? `${progress * 100}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2">
        {group.avatar_url ? (
          <div className="relative h-8 w-8 overflow-hidden rounded-full">
            <Image src={group.avatar_url} alt={group.username} fill className="object-cover" sizes="32px" />
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
            {group.username[0].toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{group.username}</p>
          <p className="text-[10px] text-zinc-400">{timeAgo(story.created_at)}</p>
        </div>
        <button onClick={onClose} className="p-2 text-white">
          <X size={24} />
        </button>
      </div>

      {/* Story content */}
      <div className="relative flex-1 flex items-center justify-center">
        {story.media_url ? (
          <Image src={story.media_url} alt="" fill className="object-contain" sizes="100vw" />
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-xl text-white text-center">{story.caption}</p>
          </div>
        )}

        {/* Tap zones */}
        <button onClick={goBack} className="absolute left-0 top-0 w-1/3 h-full" aria-label="Previous" />
        <button onClick={advance} className="absolute right-0 top-0 w-2/3 h-full" aria-label="Next" />

        {/* Caption overlay */}
        {story.caption && story.media_url && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-12">
            <p className="text-sm text-white">{story.caption}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ExploreClient() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { isProvider, profile } = useProfile();
  const [searchQuery, setSearchQuery]     = useState("");
  const [cityQuery, setCityQuery]         = useState("");
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [activeChip, setActiveChip]       = useState("all");
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [posts, setPosts]                 = useState<FeedPost[]>([]);
  const [storyGroups, setStoryGroups]     = useState<StoryGroup[]>([]);
  const [loading, setLoading]             = useState(true);
  const [loadingMore, setLoadingMore]     = useState(false);
  const [hasMore, setHasMore]             = useState(true);
  const [geoLoading, setGeoLoading]       = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userCity, setUserCity]           = useState<string | null>(null);
  const [likedPostIds, setLikedPostIds]   = useState<Set<string>>(new Set());
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds]     = useState<Set<string>>(new Set());
  const [viewingStory, setViewingStory]   = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const PAGE_SIZE = 10;

  const { pulling, refreshing, pullDistance, progress } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([fetchFeed(cityQuery), fetchStories()]);
    },
  });

  // Fetch feed posts via RPC, then interleave promoted posts.
  // Initial load (offset=0) replaces; subsequent calls append.
  const fetchFeed = useCallback(async (city: string) => {
    setLoading(true);
    setHasMore(true);

    const cityTrimmed = city.trim() || null;
    const promoCity = cityTrimmed || userCity;

    const [organicRes, promotedRes] = await Promise.all([
      supabase.rpc("get_feed_posts", {
        p_country_code: null,
        p_city: cityTrimmed,
        p_limit: PAGE_SIZE,
        p_offset: 0,
        p_comments_per_post: 3,
      }),
      promoCity
        ? supabase.rpc("get_promoted_feed_posts", {
            p_city: promoCity,
            p_limit: 6,
            p_comments_per_post: 2,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (organicRes.error) {
      console.error("Feed error:", organicRes.error.message);
      setPosts([]);
      setHasMore(false);
    } else {
      const organic = (organicRes.data ?? []) as FeedPost[];
      const promoted = ((promotedRes.data ?? []) as FeedPost[]).map((p) => ({
        ...p,
        is_promoted: true,
      }));

      // Interleave: 1 promoted every 5 organic posts
      const INTERVAL = 5;
      const organicPostIds = new Set(organic.map((p) => p.post_id));
      const uniquePromoted = promoted.filter((p) => !organicPostIds.has(p.post_id));

      const merged: FeedPost[] = [];
      let promoIdx = 0;
      for (let i = 0; i < organic.length; i++) {
        merged.push(organic[i]);
        if ((i + 1) % INTERVAL === 0 && promoIdx < uniquePromoted.length) {
          merged.push(uniquePromoted[promoIdx]);
          promoIdx++;
        }
      }

      setPosts(merged);
      // If we got fewer organic posts than requested, no more pages
      if (organic.length < PAGE_SIZE) setHasMore(false);
    }

    setLoading(false);
  }, [userCity]);

  // Load next page of organic posts and append (no promoted re-fetch)
  const loadMoreFeed = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);

    // Use the count of *organic* (non-promoted) posts as offset
    const organicCount = posts.filter((p) => !p.is_promoted).length;
    const cityTrimmed = cityQuery.trim() || null;

    const { data, error } = await supabase.rpc("get_feed_posts", {
      p_country_code: null,
      p_city: cityTrimmed,
      p_limit: PAGE_SIZE,
      p_offset: organicCount,
      p_comments_per_post: 3,
    });

    if (error) {
      console.error("Load more error:", error.message);
      setHasMore(false);
    } else {
      const newPosts = (data ?? []) as FeedPost[];
      // Filter out duplicates against existing posts
      const existingIds = new Set(posts.map((p) => p.post_id));
      const fresh = newPosts.filter((p) => !existingIds.has(p.post_id));

      if (fresh.length === 0) {
        setHasMore(false);
      } else {
        setPosts((prev) => [...prev, ...fresh]);
        if (newPosts.length < PAGE_SIZE) setHasMore(false);
      }
    }

    setLoadingMore(false);
  }, [posts, loadingMore, hasMore, loading, cityQuery]);

  // Fetch stories via RPC
  const fetchStories = useCallback(async () => {
    const { data } = await supabase.rpc("get_active_stories", {
      p_country_code: null,
      p_viewer_id: user?.id ?? null,
      p_limit: 30,
    });
    setStoryGroups((data ?? []) as StoryGroup[]);
  }, [user?.id]);

  // Batch-fetch engagement state once posts arrive
  useEffect(() => {
    if (!user || posts.length === 0) return;
    const postIds = posts.map((p) => p.post_id);
    const providerIds = [...new Set(posts.map((p) => p.provider_id))];

    Promise.all([
      supabase.from("likes").select("status_update_id").eq("user_id", user.id).in("status_update_id", postIds),
      supabase.from("follows").select("following_id").eq("follower_id", user.id).in("following_id", providerIds),
      supabase.from("bookmarks").select("status_update_id").eq("user_id", user.id).in("status_update_id", postIds),
    ]).then(([likesRes, followsRes, bookmarksRes]) => {
      setLikedPostIds(new Set((likesRes.data ?? []).map((r: { status_update_id: string }) => r.status_update_id)));
      setFollowedIds(new Set((followsRes.data ?? []).map((r: { following_id: string }) => r.following_id)));
      setBookmarkedIds(new Set((bookmarksRes.data ?? []).map((r: { status_update_id: string }) => r.status_update_id)));
    });
  }, [user, posts]);

  // Infinite scroll: observe sentinel and call loadMoreFeed when visible
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreFeed();
      },
      { rootMargin: "400px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMoreFeed, hasMore, loading]);

  // Fetch user's city for geo-targeted promoted posts
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
    fetchFeed("");
    fetchStories();
  }, [fetchFeed, fetchStories]);

  // Debounced search/city changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // City query goes directly to RPC; text search fetches all then filters client-side
      fetchFeed(cityQuery);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery, fetchFeed]);

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
    if (id === "all") {
      setFilters((f) => ({ ...f, availableNow: false, categories: [] }));
    } else if (id === "available") {
      setFilters((f) => ({ ...f, availableNow: true, categories: [] }));
    } else {
      setFilters((f) => ({ ...f, availableNow: false, categories: [id] }));
    }
  }

  const activeCount = countActiveFilters(filters);

  // Client-side text search: filter by username or caption
  const displayPosts = searchQuery.trim()
    ? posts.filter((p) => {
        const q = searchQuery.trim().toLowerCase();
        return (
          p.provider_username?.toLowerCase().includes(q) ||
          p.caption?.toLowerCase().includes(q)
        );
      })
    : posts;

  // ══════════════════════════════════════════════════════════════════════════
  // PROVIDER VIEW — stripped-down feed, no search/filters/categories
  // ══════════════════════════════════════════════════════════════════════════

  if (isProvider) {
    return (
      <div className="min-h-screen bg-black pb-24">
        {/* ── Header ── */}
        <header className="sticky top-0 z-20 border-b border-white/5 bg-black/95 backdrop-blur-xl">
          <div className="flex items-center justify-center px-4 py-[13px]">
            <span className="text-[17px] font-bold tracking-tight text-[#FCBA03]">{t("feed_title")}</span>
          </div>
        </header>

        <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} pullDistance={pullDistance} progress={progress} />

        {/* ── Stories ── */}
        {loading ? (
          <StoriesBarSkeleton />
        ) : (
          <StoriesBar
            stories={storyGroups}
            onStoryTap={(group, index) => setViewingStory({ groups: storyGroups, index })}
            isProvider={true}
            providerAvatar={profile?.avatar_url ?? null}
          />
        )}

        {/* ── Content nudge ── */}
        <ProviderContentNudge userId={user?.id ?? null} />

        {/* ── Feed header ── */}
        {!loading && posts.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <div className="h-1 w-1 rounded-full bg-[#FCBA03]" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
              {t("feed_trending")}
            </span>
          </div>
        )}

        {/* ── Feed ── */}
        {loading ? (
          <FeedSkeleton />
        ) : posts.length === 0 ? (
          <EmptyState variant="no-results" />
        ) : (
          <div>
            {posts.map((post, i) => (
              <ScrollReveal key={post.post_id} delay={Math.min(i * 40, 300)}>
                <PostFeedCard
                  post={post}
                  userId={user?.id ?? null}
                  isLiked={likedPostIds.has(post.post_id)}
                  isBookmarked={bookmarkedIds.has(post.post_id)}
                  isFollowing={followedIds.has(post.provider_id)}
                  onDelete={(id) => setPosts((prev) => prev.filter((p) => p.post_id !== id))}
                  onBookmarkToggle={(id, next) =>
                    setBookmarkedIds((prev) => {
                      const updated = new Set(prev);
                      if (next) updated.add(id); else updated.delete(id);
                      return updated;
                    })
                  }
                  hasActiveStory={storyGroups.some((g) => g.provider_id === post.provider_id && g.has_unseen)}
                />
              </ScrollReveal>
            ))}
            {/* Pagination sentinel + loader */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex items-center justify-center py-6 text-zinc-500">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {!hasMore && posts.length > 0 && (
              <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-700">
                You&rsquo;re all caught up
              </div>
            )}
          </div>
        )}

        {/* Story viewer overlay */}
        <AnimatePresence>
          {viewingStory && (
            <StoryViewer
              groups={viewingStory.groups}
              initialGroupIndex={viewingStory.index}
              userId={user?.id ?? null}
              onClose={() => {
                setViewingStory(null);
                fetchStories();
              }}
            />
          )}
        </AnimatePresence>
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

      {/* ── Stories bar ── */}
      {loading ? (
        <StoriesBarSkeleton />
      ) : (
        <StoriesBar
          stories={storyGroups}
          onStoryTap={(group, index) => setViewingStory({ groups: storyGroups, index })}
          isProvider={false}
          providerAvatar={null}
        />
      )}

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
          onClick={() => setCategoriesOpen(true)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-zinc-900 px-3 py-2 text-[12px] font-medium text-zinc-400 transition-all hover:border-amber-400/30 hover:text-amber-400"
          aria-label="Browse categories"
        >
          <LayoutGrid size={13} />
        </button>

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
          {activeCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-zinc-950">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Category chips slider ── */}
      <div
        className="flex gap-1.5 overflow-x-auto border-b border-white/5 py-2.5"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", paddingLeft: "1rem", paddingRight: "1rem" }}
      >
        {CATEGORY_CHIPS.map((chip) => {
          const active = activeChip === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => handleChip(chip.id)}
              className={cn(
                "flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                active
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                  : "border-white/10 bg-transparent text-zinc-500 hover:border-white/15 hover:text-zinc-300"
              )}
            >
              {chip.id === "available" && (
                <span className={cn("mr-1 inline-block h-1 w-1 rounded-full align-middle", active ? "bg-emerald-400" : "bg-zinc-600")} />
              )}
              {chip.label}
            </button>
          );
        })}
        {/* View all pill — opens the categories drawer */}
        <button
          onClick={() => setCategoriesOpen(true)}
          className="flex flex-shrink-0 items-center gap-0.5 rounded-full border border-amber-400/30 bg-amber-400/5 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition-all hover:bg-amber-400/10"
        >
          View all
          <SlidersHorizontal size={9} className="ml-0.5" />
        </button>
        <div className="w-2 flex-shrink-0" />
      </div>

      {/* ── Feed ── */}
      {loading ? (
        <FeedSkeleton />
      ) : displayPosts.length === 0 ? (
        <EmptyState variant="no-results" />
      ) : (
        <div>
          <p className="px-4 py-2.5 text-[12px] text-zinc-600">
            <span className="font-medium text-zinc-400">{displayPosts.length}</span>
            {" "}posts
            {cityQuery && <span> in {cityQuery}</span>}
            {searchQuery.trim() && <span> matching &ldquo;{searchQuery.trim()}&rdquo;</span>}
          </p>

          {displayPosts.map((post, i) => (
            <ScrollReveal key={post.post_id} delay={Math.min(i * 40, 300)}>
              <PostFeedCard
                post={post}
                userId={user?.id ?? null}
                isLiked={likedPostIds.has(post.post_id)}
                isBookmarked={bookmarkedIds.has(post.post_id)}
                isFollowing={followedIds.has(post.provider_id)}
                onDelete={(id) => setPosts((prev) => prev.filter((p) => p.post_id !== id))}
                onBookmarkToggle={(id, next) =>
                  setBookmarkedIds((prev) => {
                    const updated = new Set(prev);
                    if (next) updated.add(id); else updated.delete(id);
                    return updated;
                  })
                }
                hasActiveStory={storyGroups.some((g) => g.provider_id === post.provider_id && g.has_unseen)}
              />
            </ScrollReveal>
          ))}
          {/* Pagination sentinel + loader (only when not text-searching) */}
          {!searchQuery.trim() && (
            <>
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex items-center justify-center py-6 text-zinc-500">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
              {!hasMore && posts.length > 0 && (
                <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-700">
                  You&rsquo;re all caught up
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

      {/* Story viewer overlay */}
      <AnimatePresence>
        {viewingStory && (
          <StoryViewer
            groups={viewingStory.groups}
            initialGroupIndex={viewingStory.index}
            userId={user?.id ?? null}
            onClose={() => {
              setViewingStory(null);
              fetchStories(); // Refresh unseen state
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Post feed card (with embedded comments) ─────────────────────────────────

function PostFeedCard({
  post,
  userId,
  isLiked,
  isBookmarked,
  isFollowing,
  onDelete,
  onBookmarkToggle,
  hasActiveStory = false,
}: {
  post: FeedPost;
  userId: string | null;
  isLiked: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
  onDelete?: (postId: string) => void;
  onBookmarkToggle?: (postId: string, next: boolean) => void;
  hasActiveStory?: boolean;
}) {
  const { t } = useTranslation();
  const isVerified = post.provider_verified === "verified";
  const isOwnProfile = userId === post.provider_id;
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentSent, setCommentSent] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const lastTapRef = useRef<number>(0);
  const localComments = post.latest_comments ?? [];

  // Sync bookmark state when prop changes (e.g. after batch fetch)
  useEffect(() => { setBookmarked(isBookmarked); }, [isBookmarked]);

  // Record view when post is visible for 1s+ (fires once per post)
  const articleRef = useRef<HTMLElement | null>(null);
  const viewRecordedRef = useRef(false);
  useEffect(() => {
    if (!articleRef.current || viewRecordedRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => {
            if (!viewRecordedRef.current) {
              viewRecordedRef.current = true;
              fetch("/api/posts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  statusUpdateId: post.post_id,
                  viewerId: userId,
                }),
              }).catch(() => {});
            }
          }, 1000);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(articleRef.current);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [post.post_id, userId]);

  const { isLiked: liked, likesCount, toggle: toggleLike } = useLike({
    postId: post.post_id,
    initialIsLiked: isLiked,
    initialCount: post.likes_count,
    userId,
  });

  const { isFollowing: following, toggle: toggleFollow } = useFollow({
    profileId: post.provider_id,
    initialIsFollowing: isFollowing,
    userId,
  });

  const { share, sharesCount, isSharing } = useShare({
    postId: post.post_id,
    initialCount: post.shares_count,
    userId,
  });

  async function handleShare() {
    const url = `${window.location.origin}/u/${post.provider_username}`;
    await share();
    if (navigator.share) {
      try { await navigator.share({ title: post.provider_username, url }); }
      catch {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    } else {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }

  async function handleComment() {
    if (!userId || !commentText.trim() || submitting) return;
    setSubmitting(true);

    const { error } = await supabase
      .from("comments")
      .insert({
        status_update_id: post.post_id,
        user_id: userId,
        body: commentText.trim(),
      });

    if (!error) {
      setCommentText("");
      setCommentSent(true);
      setTimeout(() => setCommentSent(false), 3000);
    }
    setSubmitting(false);
  }

  async function handleBookmark() {
    if (!userId) return;
    const next = !bookmarked;
    setBookmarked(next);
    onBookmarkToggle?.(post.post_id, next);

    if (next) {
      await supabase.from("bookmarks").insert({
        user_id: userId,
        status_update_id: post.post_id,
      });
    } else {
      await supabase
        .from("bookmarks")
        .delete()
        .eq("user_id", userId)
        .eq("status_update_id", post.post_id);
    }
  }

  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleImageTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — cancel pending single-tap, like the post
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (userId && !liked) toggleLike();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      // Schedule single-tap action (open modal) — gets cancelled if double-tap follows
      singleTapTimerRef.current = setTimeout(() => {
        setModalOpen(true);
        singleTapTimerRef.current = null;
      }, 320);
    }
  }

  return (
    <article ref={articleRef} className="border-b border-zinc-900/80 glow-card">
      {/* ── Post header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/u/${post.provider_username}`} className="flex-shrink-0">
          <StoryRingAvatar
            src={post.provider_avatar}
            alt={post.provider_username}
            size={36}
            hasStory={hasActiveStory}
            storyViewed={!hasActiveStory}
          />
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/u/${post.provider_username}`} className="text-[14px] font-semibold text-white hover:text-zinc-300 transition-colors truncate">
              {post.provider_username}
            </Link>
            {isVerified && <CheckCircle size={13} className="flex-shrink-0 text-amber-400 fill-amber-400/15" />}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {post.provider_city && (
              <>
                <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
                  <MapPin size={9} className="text-zinc-500" />
                  {post.provider_city}
                </span>
                <span className="text-zinc-700">·</span>
              </>
            )}
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{timeAgo(post.created_at)}</p>
            {post.is_promoted && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                Promoted
              </span>
            )}
          </div>
        </div>

        {!isOwnProfile ? (
          <motion.button
            onClick={toggleFollow}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className={cn(
              "flex-shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all",
              following
                ? "border-white/15 bg-transparent text-zinc-400 hover:border-red-500/30 hover:text-red-400"
                : "border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
            )}
          >
            {following ? t("post_following") : t("post_follow")}
          </motion.button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-9 z-40 w-44 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-xl">
                  <button
                    onClick={async () => {
                      if (deleting) return;
                      setDeleting(true);
                      const { error } = await supabase
                        .from("status_updates")
                        .delete()
                        .eq("id", post.post_id);
                      if (!error) {
                        onDelete?.(post.post_id);
                      }
                      setDeleting(false);
                      setMenuOpen(false);
                    }}
                    disabled={deleting}
                    className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-red-400 transition hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    {deleting ? t("post_deleting") : t("post_delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Cover image with gradient overlay + floating info ── */}
      {post.media_url && (
        <div
          onClick={handleImageTap}
          className="group block relative aspect-[4/5] w-full bg-zinc-900 overflow-hidden cursor-pointer select-none"
        >
          <Image
            src={post.media_url}
            alt={post.provider_username}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            sizes="100vw"
          />
          {/* Bottom gradient overlay */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

          {/* Verified badge — bottom left */}
          <div className="absolute bottom-3 left-3 flex items-center gap-3">
            {isVerified && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400 backdrop-blur-md border border-amber-400/20">
                <CheckCircle size={10} className="fill-amber-400/20" />
                {t("post_verified")}
              </span>
            )}
          </div>

          {/* View count — bottom right */}
          {post.views_count > 0 && (
            <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-md">
              <Eye size={10} />
              {formatCount(post.views_count)}
            </div>
          )}

          {/* Double-tap heart burst */}
          <AnimatePresence>
            {showHeartBurst && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.3, 1], opacity: [0, 1, 1] }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <Heart size={120} className="fill-red-500 text-red-500 drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Action bar with micro-animations ── */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <motion.button
          onClick={toggleLike}
          disabled={!userId}
          whileTap={{ scale: 1.3 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <Heart
            size={22}
            className={cn("transition-all duration-150", liked ? "fill-red-500 text-red-500" : "text-zinc-300")}
          />
        </motion.button>
        <motion.button
          onClick={() => setModalOpen(true)}
          disabled={!userId}
          whileTap={{ scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <MessageCircle size={22} className="text-zinc-300" />
        </motion.button>
        <motion.button
          onClick={handleShare}
          disabled={isSharing || !userId}
          whileTap={{ scale: 0.9, rotate: 15 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <Share2 size={22} className={cn("transition-all duration-150", isSharing ? "text-amber-400" : "text-zinc-300")} />
        </motion.button>

        {/* Bookmark — pushed to the right */}
        <motion.button
          onClick={handleBookmark}
          disabled={!userId}
          whileTap={{ scale: 1.2 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className="ml-auto flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
          aria-label={bookmarked ? "Remove bookmark" : "Save post"}
        >
          <Bookmark
            size={22}
            className={cn("transition-all duration-150", bookmarked ? "fill-amber-400 text-amber-400" : "text-zinc-300")}
          />
        </motion.button>
      </div>

      {/* ── Link copied toast ── */}
      {linkCopied && (
        <div className="mx-4 mt-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-center text-[12px] font-medium text-emerald-400">
          {t("post_link_copied")}
        </div>
      )}

      {/* ── Stats: "Liked by username and N others" ── */}
      {likesCount > 0 && (
        <div className="px-4 pb-1 pt-0.5">
          {localComments.length > 0 ? (
            <p className="text-[13px] text-zinc-300">
              Liked by{" "}
              <Link
                href={`/u/${localComments[0].username}`}
                className="font-semibold text-white hover:text-zinc-300"
              >
                {localComments[0].username}
              </Link>
              {likesCount > 1 && (
                <>
                  {" "}and{" "}
                  <span className="font-semibold text-white">
                    {formatCount(likesCount - 1)} {likesCount - 1 === 1 ? "other" : "others"}
                  </span>
                </>
              )}
            </p>
          ) : (
            <p className="text-[13px] font-semibold text-white">
              {formatCount(likesCount)} {likesCount === 1 ? t("post_like") : t("post_likes")}
            </p>
          )}
        </div>
      )}

      {/* ── Secondary stats row (comments + shares) ── */}
      {(post.comments_count > 0 || sharesCount > 0) && (
        <div className="flex items-center gap-3 px-4 pb-2">
          {post.comments_count > 0 && (
            <button onClick={() => setModalOpen(true)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              View all {formatCount(post.comments_count)} {post.comments_count === 1 ? t("post_comment") : t("post_comments")}
            </button>
          )}
          {sharesCount > 0 && (
            <p className="text-[12px] text-zinc-600">
              {formatCount(sharesCount)} {sharesCount === 1 ? t("post_share") : t("post_shares")}
            </p>
          )}
        </div>
      )}

      {/* ── Caption ── */}
      {post.caption && (
        <p className="px-4 pb-2 text-[13px] leading-relaxed text-zinc-200">
          <Link href={`/u/${post.provider_username}`} className="font-semibold text-white hover:text-zinc-300">
            {post.provider_username}
          </Link>
          {"  "}
          {post.caption}
        </p>
      )}

      {/* ── Comments (max 2 in feed) ── */}
      {localComments.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5">
          {localComments.slice(0, 2).map((c) => (
            <p key={c.id} className="text-[13px] text-zinc-300">
              <Link href={`/u/${c.username}`} className="font-semibold text-white hover:text-zinc-300 mr-1.5">
                {c.username}
              </Link>
              {c.body}
            </p>
          ))}
          {post.comments_count > 2 && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-300"
            >
              View all {formatCount(post.comments_count)} comments
            </button>
          )}
        </div>
      )}

      {/* ── Add comment ── */}
      {userId && (
        <div className="px-4 pb-4">
          {commentSent ? (
            <p className="text-[12px] text-emerald-400/80">
              {t("post_comment_sent_long")}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder={t("post_add_comment")}
                className="flex-1 bg-transparent text-[13px] text-zinc-400 placeholder-zinc-600 outline-none"
              />
              {commentText.trim() && (
                <button
                  onClick={handleComment}
                  disabled={submitting}
                  className="text-amber-400 disabled:opacity-40"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <AnimatePresence>
        {modalOpen && (
          <PostModal
            postId={post.post_id}
            onClose={() => setModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </article>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border-b border-zinc-900/80">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-zinc-800 shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-28 rounded-full bg-zinc-800 shimmer" />
              <div className="h-2 w-20 rounded-full bg-zinc-800/60 shimmer" />
            </div>
            <div className="h-7 w-16 rounded-full bg-zinc-800 shimmer" />
          </div>
          <div className="aspect-[4/5] w-full bg-zinc-800 shimmer" />
          <div className="flex gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
          </div>
          <div className="px-4 pb-4 space-y-2">
            <div className="h-3 w-3/4 rounded-full bg-zinc-800 shimmer" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-800 shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
