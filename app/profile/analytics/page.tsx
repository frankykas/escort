"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft, Eye, Heart, MessageCircle, Users, TrendingUp,
  BarChart3, Loader2, Image as ImageIcon, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PostStat = {
  id: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
};

type OverviewStats = {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalViews: number;
  totalFollowers: number;
  totalFollowing: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  engagementRate: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, checked } = useSession();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [posts, setPosts] = useState<PostStat[]>([]);
  const [sortBy, setSortBy] = useState<"likes" | "comments" | "views" | "recent">("likes");

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked, router]);

  useEffect(() => {
    if (!user) return;

    async function load() {
      // Fetch all posts with stats
      const { data: postsData } = await supabase
        .from("status_updates")
        .select("id, caption, media_url, created_at, likes_count, comments_count, views_count")
        .eq("provider_id", user!.id)
        .eq("post_type", "post")
        .order("created_at", { ascending: false });

      const allPosts = (postsData ?? []) as PostStat[];

      // Followers / following counts
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", user!.id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", user!.id),
      ]);

      const totalFollowers = followersRes.count ?? 0;
      const totalFollowing = followingRes.count ?? 0;
      const totalLikes = allPosts.reduce((sum, p) => sum + p.likes_count, 0);
      const totalComments = allPosts.reduce((sum, p) => sum + p.comments_count, 0);
      const totalViews = allPosts.reduce((sum, p) => sum + p.views_count, 0);
      const totalPosts = allPosts.length;

      const avgLikes = totalPosts > 0 ? totalLikes / totalPosts : 0;
      const avgComments = totalPosts > 0 ? totalComments / totalPosts : 0;
      const engagement = totalFollowers > 0 && totalPosts > 0
        ? ((totalLikes + totalComments) / totalPosts / totalFollowers) * 100
        : 0;

      setOverview({
        totalPosts,
        totalLikes,
        totalComments,
        totalViews,
        totalFollowers,
        totalFollowing,
        avgLikesPerPost: Math.round(avgLikes * 10) / 10,
        avgCommentsPerPost: Math.round(avgComments * 10) / 10,
        engagementRate: Math.round(engagement * 100) / 100,
      });

      setPosts(allPosts);
      setLoading(false);
    }

    load();
  }, [user]);

  const sortedPosts = [...posts].sort((a, b) => {
    switch (sortBy) {
      case "likes": return b.likes_count - a.likes_count;
      case "comments": return b.comments_count - a.comments_count;
      case "views": return b.views_count - a.views_count;
      case "recent": return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const topPost = posts.length > 0
    ? posts.reduce((best, p) => (p.likes_count + p.comments_count > best.likes_count + best.comments_count ? p : best), posts[0])
    : null;

  if (loading || !overview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  const cards: { label: string; value: string; icon: React.ElementType; color: string; bg: string }[] = [
    { label: "Total Posts", value: formatCount(overview.totalPosts), icon: ImageIcon, color: "text-pink-400", bg: "bg-pink-500/10" },
    { label: "Total Likes", value: formatCount(overview.totalLikes), icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10" },
    { label: "Total Comments", value: formatCount(overview.totalComments), icon: MessageCircle, color: "text-teal-400", bg: "bg-teal-500/10" },
    { label: "Total Views", value: formatCount(overview.totalViews), icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Followers", value: formatCount(overview.totalFollowers), icon: Users, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Avg Likes/Post", value: `${overview.avgLikesPerPost}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Avg Comments/Post", value: `${overview.avgCommentsPerPost}`, icon: TrendingUp, color: "text-sky-400", bg: "bg-sky-500/10" },
    { label: "Engagement Rate", value: `${overview.engagementRate}%`, icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-amber-400" />
          <span className="text-[15px] font-bold text-white">Analytics</span>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">
        {/* Overview cards */}
        <section>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", card.bg)}>
                      <Icon size={16} className={card.color} />
                    </div>
                    <div>
                      <p className="text-[20px] font-bold leading-none text-white">{card.value}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{card.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Top performing post */}
        {topPost && (
          <section>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">
              Top Post
            </h2>
            <Link
              href={`/post/${topPost.id}`}
              className="block rounded-2xl border border-amber-400/20 bg-gradient-to-b from-zinc-900 to-zinc-950 overflow-hidden shadow-md transition hover:border-amber-400/40"
            >
              <div className="flex gap-4 p-4">
                {topPost.media_url && (
                  <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-800">
                    <Image
                      src={topPost.media_url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {topPost.caption && (
                    <p className="text-[13px] text-zinc-300 line-clamp-2 leading-relaxed">
                      {topPost.caption}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-[12px] text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Heart size={12} className="text-rose-400" />
                      {formatCount(topPost.likes_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle size={12} className="text-teal-400" />
                      {formatCount(topPost.comments_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={12} className="text-blue-400" />
                      {formatCount(topPost.views_count)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-600">{timeAgo(topPost.created_at)}</p>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* All posts breakdown */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Post Performance
            </h2>
            <div className="flex gap-1">
              {(["likes", "comments", "views", "recent"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
                    sortBy === s
                      ? "bg-amber-400/15 text-amber-400"
                      : "text-zinc-600 hover:text-zinc-400"
                  )}
                >
                  {s === "likes" ? "Likes" : s === "comments" ? "Comments" : s === "views" ? "Views" : "Recent"}
                </button>
              ))}
            </div>
          </div>

          {sortedPosts.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-zinc-900 py-12 text-center">
              <ImageIcon size={24} className="mx-auto text-zinc-700 mb-2" />
              <p className="text-[13px] text-zinc-600">{t("analytics_no_posts")}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md overflow-hidden divide-y divide-white/5">
              {sortedPosts.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/40"
                >
                  <span className="w-6 text-center text-[12px] font-bold text-zinc-600">
                    {i + 1}
                  </span>
                  <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                    {post.media_url ? (
                      <Image
                        src={post.media_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon size={14} className="text-zinc-700" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-zinc-400 truncate">
                      {post.caption || "No caption"}
                    </p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{timeAgo(post.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Heart size={11} className="text-rose-400/70" />
                      {post.likes_count}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <MessageCircle size={11} className="text-teal-400/70" />
                      {post.comments_count}
                    </span>
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Eye size={11} className="text-blue-400/70" />
                      {post.views_count}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
