"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MapPin, SlidersHorizontal, CheckCircle,
  X, Heart, MessageCircle, Share2, Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { FilterDrawer, DEFAULT_FILTERS, type Filters } from "./FilterDrawer";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSession } from "@/hooks/useSession";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";
import { useShare } from "@/hooks/useShare";

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
};

type StoryGroup = {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
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
  { id: "Dinner Date",   label: "Dinner Date" },
  { id: "Travel",        label: "Travel" },
  { id: "Massage",       label: "Massage" },
  { id: "Couples",       label: "Couples" },
  { id: "Domination",    label: "Domination" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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

// ─── Stories bar (real stories with unseen ring) ─────────────────────────────

function StoriesBar({
  stories,
  onStoryTap,
}: {
  stories: StoryGroup[];
  onStoryTap: (group: StoryGroup, index: number) => void;
}) {
  if (stories.length === 0) return null;
  return (
    <div className="border-b border-white/5 bg-black">
      <div
        className="flex gap-5 overflow-x-auto px-4 py-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stories.map((group, i) => (
          <button
            key={group.provider_id}
            onClick={() => onStoryTap(group, i)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none"
          >
            <div className={cn(
              "rounded-full p-[2.5px]",
              group.has_unseen
                ? "bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300"
                : "bg-zinc-700"
            )}>
              <div className="rounded-full p-[2px] bg-black">
                {group.avatar_url ? (
                  <div className="relative h-[58px] w-[58px] overflow-hidden rounded-full">
                    <Image src={group.avatar_url} alt={group.username} fill className="object-cover" sizes="58px" />
                  </div>
                ) : (
                  <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-zinc-800 text-base font-bold text-zinc-300">
                    {group.username[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <span className="max-w-[60px] truncate text-[10px] text-zinc-400">{group.username}</span>
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
  const [searchQuery, setSearchQuery]     = useState("");
  const [cityQuery, setCityQuery]         = useState("");
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [activeChip, setActiveChip]       = useState("all");
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [posts, setPosts]                 = useState<FeedPost[]>([]);
  const [storyGroups, setStoryGroups]     = useState<StoryGroup[]>([]);
  const [loading, setLoading]             = useState(true);
  const [geoLoading, setGeoLoading]       = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [likedPostIds, setLikedPostIds]   = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds]     = useState<Set<string>>(new Set());
  const [viewingStory, setViewingStory]   = useState<{ groups: StoryGroup[]; index: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch feed posts via RPC
  const fetchFeed = useCallback(async (city: string) => {
    setLoading(true);

    const { data, error } = await supabase.rpc("get_feed_posts", {
      p_country_code: null,
      p_city: city.trim() || null,
      p_limit: 40,
      p_offset: 0,
      p_comments_per_post: 3,
    });

    if (error) {
      console.error("Feed error:", error.message);
      setPosts([]);
    } else {
      setPosts((data ?? []) as FeedPost[]);
    }

    setLoading(false);
  }, []);

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
    ]).then(([likesRes, followsRes]) => {
      setLikedPostIds(new Set((likesRes.data ?? []).map((r: { status_update_id: string }) => r.status_update_id)));
      setFollowedIds(new Set((followsRes.data ?? []).map((r: { following_id: string }) => r.following_id)));
    });
  }, [user, posts]);

  // Initial load
  useEffect(() => {
    fetchFeed("");
    fetchStories();
  }, [fetchFeed, fetchStories]);

  // Debounced search/city changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // For search queries, we fall back to the city-based filter for now
      // (search by username requires a different approach — city filter covers the main use case)
      fetchFeed(searchQuery.trim() || cityQuery);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, cityQuery, fetchFeed]);

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
      {loading ? (
        <StoriesBarSkeleton />
      ) : (
        <StoriesBar
          stories={storyGroups}
          onStoryTap={(group, index) => setViewingStory({ groups: storyGroups, index })}
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
      ) : posts.length === 0 ? (
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
            <span className="font-medium text-zinc-400">{posts.length}</span>
            {" "}posts
            {cityQuery && <span> in {cityQuery}</span>}
          </p>

          {posts.map((post, i) => (
            <motion.div
              key={post.post_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
            >
              <PostFeedCard
                post={post}
                userId={user?.id ?? null}
                isLiked={likedPostIds.has(post.post_id)}
                isFollowing={followedIds.has(post.provider_id)}
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
  isFollowing,
}: {
  post: FeedPost;
  userId: string | null;
  isLiked: boolean;
  isFollowing: boolean;
}) {
  const isVerified = post.provider_verified === "verified";
  const isOwnProfile = userId === post.provider_id;
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [commentSent, setCommentSent] = useState(false);
  const localComments = post.latest_comments ?? [];

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
      catch { await navigator.clipboard.writeText(url); }
    } else {
      await navigator.clipboard.writeText(url);
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

  return (
    <article className="border-b border-zinc-900/80">
      {/* ── Post header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/u/${post.provider_username}`} className="flex-shrink-0">
          <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300">
            <div className="rounded-full p-[1.5px] bg-black">
              {post.provider_avatar ? (
                <div className="relative h-9 w-9 overflow-hidden rounded-full">
                  <Image src={post.provider_avatar} alt={post.provider_username} fill className="object-cover" sizes="36px" />
                </div>
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
                  {post.provider_username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Link href={`/u/${post.provider_username}`} className="text-[14px] font-semibold text-white hover:text-zinc-300 transition-colors truncate">
              {post.provider_username}
            </Link>
            {isVerified && <CheckCircle size={13} className="flex-shrink-0 text-amber-400 fill-amber-400/15" />}
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500 uppercase tracking-wide">{timeAgo(post.created_at)}</p>
        </div>

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
      </div>

      {/* ── Cover image ── */}
      {post.media_url && (
        <Link href={`/u/${post.provider_username}`} className="block relative aspect-square w-full bg-zinc-900">
          <Image src={post.media_url} alt={post.provider_username} fill className="object-cover" sizes="100vw" />
        </Link>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center gap-1 px-3 pt-3 pb-1">
        <button
          onClick={toggleLike}
          disabled={!userId}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <Heart
            size={22}
            className={cn("transition-all duration-150", liked ? "fill-red-500 text-red-500 scale-110" : "text-zinc-300")}
          />
        </button>
        <button className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5">
          <MessageCircle size={22} className="text-zinc-300" />
        </button>
        <button
          onClick={handleShare}
          disabled={isSharing || !userId}
          className="flex items-center gap-1.5 rounded-full p-2 transition-all hover:bg-white/5 disabled:opacity-40"
        >
          <Share2 size={22} className={cn("transition-all duration-150", isSharing ? "text-amber-400 scale-110" : "text-zinc-300")} />
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-0.5">
        {likesCount > 0 && (
          <p className="text-[13px] font-semibold text-white">
            {formatCount(likesCount)} {likesCount === 1 ? "like" : "likes"}
          </p>
        )}
        {post.comments_count > 0 && (
          <p className="text-[13px] text-zinc-500">
            {formatCount(post.comments_count)} {post.comments_count === 1 ? "comment" : "comments"}
          </p>
        )}
        {sharesCount > 0 && (
          <p className="text-[13px] text-zinc-500">
            {formatCount(sharesCount)} {sharesCount === 1 ? "share" : "shares"}
          </p>
        )}
      </div>

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

      {/* ── Comments ── */}
      {localComments.length > 0 && (
        <div className="px-4 pb-2 space-y-1.5">
          {localComments.map((c) => (
            <p key={c.id} className="text-[13px] text-zinc-300">
              <Link href={`/u/${c.username}`} className="font-semibold text-white hover:text-zinc-300 mr-1.5">
                {c.username}
              </Link>
              {c.body}
            </p>
          ))}
        </div>
      )}

      {/* ── Add comment ── */}
      {userId && (
        <div className="px-4 pb-4">
          {commentSent ? (
            <p className="text-[12px] text-emerald-400/80">
              Comment sent — visible once approved by the creator.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder="Add a comment…"
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
          <div className="px-4 pb-4 space-y-2">
            <div className="h-3 w-3/4 rounded-full bg-zinc-800" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
