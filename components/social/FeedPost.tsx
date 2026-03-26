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
import { cn } from "@/lib/utils";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";
import type { FeedPostData } from "./SocialHome";

type Props = {
  post: FeedPostData;
  isLiked: boolean;
  isFollowing: boolean;
  userId: string | null;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatTimestamp(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "JUST NOW";
  if (minutes < 60) return `${minutes} MINUTE${minutes !== 1 ? "S" : ""} AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} HOUR${hours !== 1 ? "S" : ""} AGO`;
  const days = Math.floor(hours / 24);
  return `${days} DAY${days !== 1 ? "S" : ""} AGO`;
}

export function FeedPost({ post, isLiked, isFollowing, userId }: Props) {
  const { caption, media_url, created_at, likes_count, comments_count, views_count, profiles } =
    post;
  const { username, avatar_url, verification_status } = profiles;
  const isVerified = verification_status === "verified";
  const isOwnPost = userId === profiles.id;

  const { isLiked: liked, likesCount, toggle: toggleLike } = useLike({
    postId: post.id,
    initialIsLiked: isLiked,
    initialCount: likes_count,
    userId,
  });

  const { isFollowing: following, toggle: toggleFollow } = useFollow({
    profileId: profiles.id,
    initialIsFollowing: isFollowing,
    userId,
  });

  return (
    <article className="mx-3 my-2 overflow-hidden rounded-2xl bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/5 shadow-md">
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
          {/* Follow — hidden on own posts and when signed out */}
          {userId && !isOwnPost && (
            <button
              onClick={toggleFollow}
              className={cn(
                "text-[13px] font-semibold transition-colors",
                following ? "text-zinc-400" : "text-sky-400"
              )}
            >
              {following ? "Following" : "Follow"}
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
        <Link href={`/post/${post.id}`}>
          <div className="relative aspect-square w-full bg-zinc-900">
            <Image
              src={media_url}
              alt={caption ?? "Post"}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        </Link>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleLike}
            aria-label={liked ? "Unlike" : "Like"}
            className="transition-transform active:scale-90"
          >
            <Heart
              size={26}
              className={cn(
                "transition-colors",
                liked ? "fill-red-500 text-red-500" : "text-zinc-100"
              )}
            />
          </button>
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
          {formatCount(likesCount)} likes
        </p>
      </div>

      {/* ── Caption ── */}
      {caption && (
        <div className="px-3 pt-1">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-zinc-100">
            <span className="font-semibold mr-1.5">{username}</span>
            {caption}
            <span className="text-zinc-500"> more</span>
          </p>
        </div>
      )}

      {/* ── Comments count ── */}
      {comments_count > 0 && (
        <div className="px-3 pt-1.5">
          <Link href={`/post/${post.id}`} className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors">
            View all {comments_count} comments
          </Link>
        </div>
      )}

      {/* ── Views ── */}
      {views_count > 0 && (
        <div className="px-3 pt-0.5">
          <p className="text-[11px] text-zinc-600">
            {formatCount(views_count)} views
          </p>
        </div>
      )}

      {/* ── Ghost comment input ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 mt-1.5 border-t border-white/5">
        <div className="h-6 w-6 rounded-full bg-zinc-800 flex-shrink-0" />
        <span className="text-[13px] text-zinc-600 select-none">Add a comment…</span>
      </div>

      {/* ── Timestamp ── */}
      <div className="px-3 pb-3">
        <p className="text-[10px] tracking-widest text-zinc-600 uppercase">
          {formatTimestamp(created_at)}
        </p>
      </div>
    </article>
  );
}
