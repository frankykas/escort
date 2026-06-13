"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  CheckCircle,
  Lock,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLike } from "@/hooks/useLike";
import { useFollow } from "@/hooks/useFollow";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useSignupPrompt } from "@/hooks/useSignupPrompt";
import { apiFetch } from "@/lib/api-fetch";
import PayButton from "@/components/creator/PayButton";
import { ActivityIndicator } from "@/components/ui/ActivityIndicator";
import type { FeedPostData } from "./SocialHome";

type Props = {
  post: FeedPostData;
  isLiked: boolean;
  isFollowing: boolean;
  isUnlocked?: boolean;
  userId: string | null;
  priority?: boolean;
};

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function TapToToggleVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  return (
    <video
      ref={videoRef}
      src={src}
      className="h-full w-full object-cover"
      controls
      playsInline
      preload="metadata"
      onClick={togglePlayback}
    />
  );
}

// Loads premium media through the entitlement-gated /api/media route, which
// returns a short-TTL signed URL only when the viewer is allowed. Plain <img>
// (not next/image) since the signed URL carries a rotating token.
function PremiumMedia({ postId, mediaType, alt }: { postId: string; mediaType: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/media/${postId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) { if (d?.url) setSrc(d.url); else setFailed(true); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [postId]);

  if (failed) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-[12px] text-slate-400">
        Unavailable
      </div>
    );
  }
  if (!src) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-gray-100">
        <Loader2 size={22} className="animate-spin text-slate-300" />
      </div>
    );
  }
  return mediaType === "video" ? (
    <TapToToggleVideo src={src} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-full w-full object-cover" />
  );
}

// Blurred lock state for premium content the viewer hasn't unlocked.
function LockedMedia({
  post,
  onError,
}: {
  post: FeedPostData;
  onError: (msg: string) => void;
}) {
  const isPpv = post.unlock_price != null;
  return (
    <div className="relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden bg-gradient-to-br from-pink-50 via-white to-sky-50">
      <div className="absolute inset-0 backdrop-blur-2xl" />
      <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/80 shadow-sm">
        <Lock size={24} className="text-pink-500" />
      </div>
      <p className="relative text-[13px] font-semibold text-slate-700">
        {isPpv ? "Pay-per-view content" : "Subscribers only"}
      </p>
      <div className="relative">
        {isPpv ? (
          <PayButton
            purpose="ppv"
            referenceId={post.post_id}
            label={`Unlock · CA$${Math.round((post.unlock_price as number) / 100)}`}
            onError={onError}
          />
        ) : (
          <Link
            href={`/u/${post.provider_username}`}
            className="flex items-center gap-2 rounded-full bg-[rgb(246,51,154)] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105"
          >
            Subscribe to view
          </Link>
        )}
      </div>
    </div>
  );
}

function cleanCaption(caption: string | null): string | null {
  if (!caption) return null;
  return caption
    .replace(/\s*\[seed:search\]\s*/gi, " ")
    .replace(/\s+\d+\)\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim() || null;
}

function formatTimestamp(
  isoString: string,
  locale: "en" | "fr",
  t: (k: import("@/lib/i18n/en").TranslationKey) => string,
): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("time_just_now_up");
  if (minutes < 60) {
    const unit = minutes !== 1 ? t("time_minutes") : t("time_minute");
    return locale === "fr" ? `${t("time_ago")} ${minutes} ${unit}` : `${minutes} ${unit} ${t("time_ago")}`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const unit = hours !== 1 ? t("time_hours") : t("time_hour");
    return locale === "fr" ? `${t("time_ago")} ${hours} ${unit}` : `${hours} ${unit} ${t("time_ago")}`;
  }
  const days = Math.floor(hours / 24);
  const unit = days !== 1 ? t("time_days") : t("time_day");
  return locale === "fr" ? `${t("time_ago")} ${days} ${unit}` : `${days} ${unit} ${t("time_ago")}`;
}

export function FeedPost({ post, isLiked, isFollowing, isUnlocked = false, userId, priority = false }: Props) {
  const { t, locale } = useTranslation();
  const { promptIfGuest, modal: signupModal } = useSignupPrompt();
  const [mediaError, setMediaError] = useState<string | null>(null);
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
    provider_verified,
    provider_last_seen_at,
    media_type,
  } = post;
  const username = provider_username;
  const avatar_url = provider_avatar;
  const verification_status = provider_verified;
  const isVerified = verification_status === "verified";
  const isOwnPost = userId === post.provider_id;
  const displayCaption = cleanCaption(caption);

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
    <article className="mx-3 my-2 overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm">
      {signupModal}
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <Link href={`/u/${username}`} className="flex items-center gap-2.5">
          {/* Avatar with cotton candy gradient ring */}
          <div className="rounded-full p-[2px] bg-gradient-to-tr from-pink-400 via-sky-300 to-violet-400 flex-shrink-0">
            <div className="rounded-full p-[1.5px] bg-white">
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
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-50 text-xs font-semibold text-pink-400">
                  {username[0].toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <span className="text-[13px] font-semibold text-slate-800">{username}</span>
              {isVerified && (
                <CheckCircle
                  size={12}
                  className="text-pink-400 fill-pink-100 flex-shrink-0"
                />
              )}
            </div>
            <ActivityIndicator
              lastSeenAt={provider_last_seen_at}
              compact
              labelMode="short"
              className="mt-0.5 border-0 bg-transparent px-0 py-0 text-[9px]"
            />
          </div>
        </Link>

        <div className="flex items-center gap-3">
          {!isOwnPost && (
            <button
              onClick={() => { if (!promptIfGuest("follow")) toggleFollow(); }}
              className={cn(
                "rounded-full px-3.5 py-1 text-[12px] font-semibold transition-colors",
                following
                  ? "border border-gray-200 bg-white text-slate-500 hover:bg-gray-50"
                  : "bg-[rgb(246,51,154)] text-white shadow-sm hover:brightness-105"
              )}
            >
              {following ? t("post_following") : t("post_follow")}
            </button>
          )}
          <button
            aria-label="More options"
            className="text-slate-300 hover:text-slate-600 transition-colors"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* ── Media ── */}
      {post.is_premium ? (
        <div className="relative aspect-square w-full bg-gray-50">
          {isUnlocked ? (
            <PremiumMedia postId={post.post_id} mediaType={media_type} alt={displayCaption ?? "Post"} />
          ) : (
            <LockedMedia post={post} onError={setMediaError} />
          )}
        </div>
      ) : (
        media_url && (
          <div className="relative aspect-square w-full bg-gray-50">
            {media_type === "video" ? (
              <TapToToggleVideo src={media_url} />
            ) : (
              <Link href={`/post/${post.post_id}`} className="block h-full w-full">
                <Image
                  src={media_url}
                  alt={displayCaption ?? "Post"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 470px"
                  priority={priority}
                />
              </Link>
            )}
          </div>
        )
      )}
      {mediaError && (
        <p className="px-3 pt-2 text-[12px] text-red-500">{mediaError}</p>
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
                liked ? "fill-red-500 text-red-500" : "text-slate-700"
              )}
            />
          </motion.button>
          <button aria-label="Comment" className="text-slate-700 hover:text-slate-400 transition-colors">
            <MessageCircle size={26} />
          </button>
          <button aria-label="Share" className="text-slate-700 hover:text-slate-400 transition-colors">
            <Send size={24} />
          </button>
        </div>
        <button aria-label="Save" className="text-slate-700 hover:text-slate-400 transition-colors">
          <Bookmark size={24} />
        </button>
      </div>

      {/* ── Likes count ── */}
      <div className="px-3 pt-1">
        <p className="text-[13px] font-semibold text-slate-800">
          {formatCount(likesCount)} {t("post_likes")}
        </p>
      </div>

      {/* ── Caption ── */}
      {displayCaption && (
        <div className="px-3 pt-1">
          <p className="line-clamp-2 text-[13px] leading-relaxed text-slate-700">
            <span className="font-semibold mr-1.5">{username}</span>
            {displayCaption}
            <span className="text-slate-400"> {t("post_more")}</span>
          </p>
        </div>
      )}

      {/* ── Comments count ── */}
      {comments_count > 0 && (
        <div className="px-3 pt-1.5">
          <Link href={`/post/${post.post_id}`} className="text-[13px] text-slate-400 hover:text-slate-600 transition-colors">
            {t("feed_view_comments")} {comments_count} {t("feed_comments")}
          </Link>
        </div>
      )}

      {/* ── Views ── */}
      {views_count > 0 && (
        <div className="px-3 pt-0.5">
          <p className="text-[11px] text-slate-400">
            {formatCount(views_count)} {t("feed_views")}
          </p>
        </div>
      )}

      {/* ── Ghost comment input ── */}
      <div className="flex items-center gap-3 px-3 py-2.5 mt-1.5 border-t border-gray-100">
        <div className="h-6 w-6 rounded-full bg-gray-100 flex-shrink-0" />
        <span className="text-[13px] text-slate-400 select-none">{t("post_add_comment")}</span>
      </div>

      {/* ── Timestamp ── */}
      <div className="px-3 pb-3">
        <p className="text-[10px] tracking-widest text-slate-400 uppercase">
          {formatTimestamp(created_at, locale, t)}
        </p>
      </div>
    </article>
  );
}
