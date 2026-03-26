"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { FeedPost } from "./FeedPost";
import { StoriesBar } from "./StoriesBar";
import type { FeedPostData } from "./SocialHome";

type Props = { posts: FeedPostData[] };

export function FeedList({ posts }: Props) {
  const { user } = useSession();
  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [followedProfileIds, setFollowedProfileIds] = useState<Set<string>>(new Set());
  const [engagementLoaded, setEngagementLoaded] = useState(false);

  useEffect(() => {
    if (!user) {
      setLikedPostIds(new Set());
      setFollowedProfileIds(new Set());
      setEngagementLoaded(true);
      return;
    }

    const postIds = posts.map((p) => p.id);
    const profileIds = [...new Set(posts.map((p) => p.profiles.id))];

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
    ]).then(([likesResult, followsResult]) => {
      setLikedPostIds(
        new Set((likesResult.data ?? []).map((r) => r.status_update_id as string))
      );
      setFollowedProfileIds(
        new Set((followsResult.data ?? []).map((r) => r.following_id as string))
      );
      setEngagementLoaded(true);
    });
  }, [user, posts]);

  if (posts.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <p className="text-sm text-zinc-500">No active posts right now. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 bg-zinc-950">
      <StoriesBar posts={posts} />

      <div className="flex flex-col pt-1">
        {posts.map((post, index) => (
          <motion.div
            key={`${post.id}-${engagementLoaded}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.06, ease: "easeOut" }}
          >
            <FeedPost
              post={post}
              isLiked={engagementLoaded ? likedPostIds.has(post.id) : false}
              isFollowing={engagementLoaded ? followedProfileIds.has(post.profiles.id) : false}
              userId={user?.id ?? null}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
