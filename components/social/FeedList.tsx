"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { FeedPost } from "./FeedPost";
import { StoriesBar } from "./StoriesBar";
import { ScrollReveal } from "@/components/ui/AmbientEffects";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { ShieldCheck } from "lucide-react";
import type { FeedPostData } from "./SocialHome";

type Props = { posts: FeedPostData[] };

export function FeedList({ posts }: Props) {
  const { user } = useSession();
  const { t } = useTranslation();
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [followedProfileIds, setFollowedProfileIds] = useState<Set<string>>(new Set());
  const [unlockedPostIds, setUnlockedPostIds] = useState<Set<string>>(new Set());
  const [engagementLoaded, setEngagementLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLikedPostIds(new Set());
      setFollowedProfileIds(new Set());
      setUnlockedPostIds(new Set());
      setEngagementLoaded(true);
      return;
    }

    const postIds = posts.map((p) => p.post_id);
    const profileIds = [...new Set(posts.map((p) => p.provider_id))];
    const premiumPosts = posts.filter((p) => p.is_premium);
    const premiumPostIds = premiumPosts.map((p) => p.post_id);

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
      premiumPostIds.length
        ? supabase
            .from("content_unlocks")
            .select("content_id")
            .eq("user_id", user.id)
            .eq("content_type", "post")
            .in("content_id", premiumPostIds)
        : Promise.resolve({ data: [] as { content_id: string }[] }),
      premiumPosts.length
        ? supabase
            .from("subscriptions")
            .select("provider_id, status, current_period_end")
            .eq("subscriber_id", user.id)
            .in("status", ["active", "cancelled"])
        : Promise.resolve({ data: [] as { provider_id: string; status: string; current_period_end: string | null }[] }),
      premiumPosts.length
        ? supabase
            .from("bundle_subscriptions")
            .select("current_period_end")
            .eq("subscriber_id", user.id)
            .in("status", ["active", "cancelled"])
        : Promise.resolve({ data: [] as { current_period_end: string | null }[] }),
    ]).then(([likesResult, followsResult, unlocksResult, subsResult, bundleResult]) => {
      setLikedPostIds(
        new Set((likesResult.data ?? []).map((r) => r.status_update_id as string))
      );
      setFollowedProfileIds(
        new Set((followsResult.data ?? []).map((r) => r.following_id as string))
      );

      const unlockedContentIds = new Set(
        (unlocksResult.data ?? []).map((r) => r.content_id as string)
      );
      const subscribedProviders = new Set(
        (subsResult.data ?? [])
          .filter((s) => !s.current_period_end || new Date(s.current_period_end).getTime() > Date.now())
          .map((s) => s.provider_id as string)
      );
      // An active all-access bundle unlocks every creator's subscriber-only posts.
      const hasBundle = (bundleResult.data ?? []).some(
        (b) => !b.current_period_end || new Date(b.current_period_end).getTime() > Date.now()
      );

      const unlocked = new Set<string>();
      for (const post of premiumPosts) {
        if (post.provider_id === user.id) {
          unlocked.add(post.post_id);
        } else if (post.unlock_price != null) {
          if (unlockedContentIds.has(post.post_id)) unlocked.add(post.post_id);
        } else if (subscribedProviders.has(post.provider_id) || hasBundle) {
          unlocked.add(post.post_id);
        }
      }
      setUnlockedPostIds(unlocked);
      setEngagementLoaded(true);
    });
  }, [user, posts]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-slate-400">{t("post_no_posts_now")}</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 bg-[#fafbfc]">
      <StoriesBar />

      <div className="flex flex-col pt-1">
        {posts.map((post, index) => (
          <ScrollReveal
            key={`${post.post_id}-${engagementLoaded}`}
            delay={Math.min(index * 60, 300)}
          >
            {index === 2 && <SecretBenefitsAd />}
            <FeedPost
              post={post}
              isLiked={engagementLoaded ? likedPostIds.has(post.post_id) : false}
              isFollowing={engagementLoaded ? followedProfileIds.has(post.provider_id) : false}
              isUnlocked={engagementLoaded ? unlockedPostIds.has(post.post_id) : false}
              userId={user?.id ?? null}
              priority={index === 0}
            />
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}

function SecretBenefitsAd() {
  return (
    <a
      href="https://www.secretbenefits.ca"
      target="_blank"
      rel="noreferrer"
      className="mx-3 my-2 flex items-center justify-between gap-3 rounded-2xl border border-pink-200 bg-white px-4 py-3 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50">
          <ShieldCheck size={18} className="text-pink-500" />
        </div>
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-pink-500">Promotion</p>
          <p className="text-[13px] font-semibold text-slate-800">SecretBenefits.ca</p>
          <p className="text-[11px] text-slate-400">Discreet dating visibility for adults.</p>
        </div>
      </div>
      <span className="rounded-full bg-pink-500 px-3 py-1.5 text-[11px] font-bold text-white">Visit</span>
    </a>
  );
}
