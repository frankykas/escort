"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  CheckCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";
import type { FeedPostData } from "./SocialHome";

type Props = {
  post: FeedPostData;
  isLiked: boolean;
  isFollowing: boolean;
  userId: string | null;
  /** True for the first post in the feed — sets fetchPriority high so this is the LCP image. */
  priority?: boolean;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTimestamp(isoString: string, t: (k: import("@/lib/i18n/en").TranslationKey) => string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time_just_now_up");
  if (minutes < 60) return `${minutes} ${minutes !== 1 ? t("time_minutes") : t("time_minute")} ${t("time_ago")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours !== 1 ? t("time_hours") : t("time_hour")} ${t("time_ago")}`;
  const days = Math.floor(hours / 24);
  return `${days} ${days !== 1 ? t("time_days") : t("time_day")} ${t("time_ago")}`;
}

export function FeedPost({ post, isLiked, isFollowing, userId, priority = false }: Props) {
  const { t } = useTranslation();
  const { promptIfGuest, modal: signupModal } = useSignupPrompt();
  const {
    caption, 
    media_url, 
    created_at, 
    likes_count, 
    comments_count, 
    shares_count, 
    views_count, 
    provider_username,
    provider_avatar,
    provider_verified
  } = post;
  const username = provider_username;
  const avatar_url = provider_avatar;
  const verification_status = provider_verified;
  const isVerified = verification_status === "verified";
  const isOwnPost = userId === post.provider_id;

  const { isLiked: liked, likesCount, toggle: toggleLike } = useLike({
    postId: post.post_id,
    initialIsLiked: isLiked,
    initialCount: likes_count,
    userId,
  });

  const { isFollowing: following, toggle: toggleFollow } = useFollow({
    profileId: post.provider_id,
    initialIsFollowing: isFollowing,
    userId,
  });

  return (
    <article className="mx-3 my-2 overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/5 shadow-md glow-card">
      {signupModal}
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
        <Link href={`/u/${username}`} className="flex items-center gap-2.5">
          {/* Avatar with amber gradient ring */}
          <div className="rounded-full p-[2px] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex-shrink-0">
            <div className="rounded-full p-[1.5px] bg-black">
              {avatar_url ? (
                <div className="relative h-8 w-8 overflow-hidden rounded-full">
                  <Image
                    src={avatar_url}
                    alt={username}
                    fill
                    className="object-cover"
                    sizes="32px"
                  />
                </div>
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300">
                  {username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Username + verified */}
          <div className="flex items-center gap-1">
            <span className="text-[13px] font-semibold text-white">{username}</span>
            {isVerified && (
              <CheckCircle
                size={12}
                className="text-amber-400 fill-amber-400/20 flex-shrink-0"
              />
            )}
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {/* Follow — hidden on own posts */}
          {!isOwnPost && (
            <button
              onClick={() => { if (!promptIfGuest("follow")) toggleFollow(); }}
              className={cn(
                "text-[13px] font-semibold transition-colors",
                following ? "text-zinc-400" : "text-sky-400"
              )}
            >
              {following ? t("post_following") : t("post_follow")}
            </button>
          )}
          <button
            aria-label="More options"
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* ── Image — full-width square, links to post detail ── */}
      {media_url && (
        <Link href={`/post/${post.post_id}`}>
          <div className="relative aspect-square w-full bg-zinc-900">
            <Image
              src={media_url}
              alt={caption ?? "Post"}
              fill
              className="object-cover"
              // Feed is full-width on mobile, capped at ~470px on tablet/desktop.
              // A bare "100vw" forces a 1920px image on big screens for no reason.
              sizes="(max-width: 640px) 100vw, 470px"
              priority={priority}
            />
          </div>
        </Link>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => { if (!promptIfGuest("like")) toggleLike(); }}
            aria-label={liked ? "Unlike" : "Like"}
            whileTap={{ scale: 1.3 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
          >
            <Heart
              size={26}
              className={cn(
                "transition-colors",
                liked ? "fill-red-500 text-red-500" : "text-zinc-100"
              )}
            />
          </motion.button>
          <button aria-label="Comment" className="text-zinc-100 hover:text-zinc-400 transition-colors">
            <MessageCircle size={26} />
          </button>
          <button aria-label="Share" className="text-zinc-100 hover:text-zinc-400 transition-colors">
            <Send size={24} />
          </button>
        </div>
        <button aria-label="Save" className="text-zinc-100 hover:text-zinc-400 transition-colors">
          <Bookmark size={24} />
        </button>
      </div>

      {/* ── Likes count ── */}
      <div className="px-3 pt-1">
        <p className="text-[13px] font-semibold text-white">
          {formatCount(likesCount)} {t("post_likes")}
        </p>
      </div>

      {/* ── Caption ── */}
      {caption && (
        <div className="px-3 pt-1">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-zinc-100">
            <span className="font-semibold mr-1.5">{username}</span>
            {caption}
            <span className="text-zinc-500"> {t("post_more")}</span>
          </p>
        </div>
      )}

      {/* ── Comments count ── */}
      {comments_count > 0 && (
        <div className="px-3 pt-1.5">
          <Link href={`/post/${post.post_id}`} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
            {t("feed_view_comments")} {comments_count} {t("feed_comments")}
          </Link>
        </div>
      )}

      {/* ── Views ── */}
      {views_count > 0 && (
        <div className="px-3 pt-0.5">
          <p className="text-[11px] text-zinc-600">
            {formatCount(views_count)} {t("feed_views")}
          </p>
        </div>
      )}

      {/* ── Ghost comment input ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 mt-1.5 border-t border-white/5">
        <div className="h-6 w-6 rounded-full bg-zinc-800 flex-shrink-0" />
        <span className="text-[13px] text-zinc-600 select-none">{t("post_add_comment")}</span>
      </div>

      {/* ── Timestamp ── */}
      <div className="px-3 pb-3">
        <p className="text-[10px] tracking-widest text-zinc-600 uppercase">
          {formatTimestamp(created_at, t)}
        </p>
      </div>
    </article>
  );
}
