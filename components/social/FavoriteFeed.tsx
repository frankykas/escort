"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { FeedList } from "./FeedList";
import type { FeedPostData } from "./SocialHome";

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border-b border-zinc-800">
          <div className="flex items-center gap-2.5 px-3 py-3">
            <div className="h-9 w-9 rounded-full bg-zinc-800 shimmer" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded-full bg-zinc-800 shimmer" />
              <div className="h-2 w-16 rounded-full bg-zinc-800/60 shimmer" />
            </div>
          </div>
          <div className="aspect-[4/5] w-full bg-zinc-800 shimmer" />
          <div className="flex gap-3 px-3 py-3">
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
            <div className="h-6 w-6 rounded-full bg-zinc-800 shimmer" />
          </div>
          <div className="px-3 pb-3 space-y-2">
            <div className="h-3 w-3/4 rounded-full bg-zinc-800 shimmer" />
            <div className="h-3 w-1/2 rounded-full bg-zinc-800 shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyFavorites({ hasFollows }: { hasFollows: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
        <Heart size={28} className="text-zinc-600" />
      </div>
      {hasFollows ? (
        <>
          <h3 className="text-base font-semibold text-white">{t("home_no_recent")}</h3>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
            {t("home_no_recent_body")}
          </p>
          <Link
            href="/"
            className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            {t("home_browse_all")}
          </Link>
        </>
      ) : (
        <>
          <h3 className="text-base font-semibold text-white">{t("home_no_favorites")}</h3>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
            {t("home_no_fav_body")}
          </p>
          <Link
            href="/"
            className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            {t("home_discover")}
          </Link>
        </>
      )}
    </div>
  );
}

function SignInPrompt() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
        <Heart size={28} className="text-zinc-600" />
      </div>
      <h3 className="text-base font-semibold text-white">{t("home_your_favorites")}</h3>
      <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
        {t("home_sign_in_fav")}
      </p>
      <Link
        href="/auth/signin"
        className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
      >
        {t("sign_in")}
      </Link>
      <Link
        href="/auth/signup"
        className="mt-3 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {t("home_create_account")}
      </Link>
    </div>
  );
}

export function FavoriteFeed() {
  const { user, loading: sessionLoading } = useSession();
  const [posts, setPosts] = useState<FeedPostData[]>([]);
  const [hasFollows, setHasFollows] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) { setFetching(false); return; }

    async function load() {
      setFetching(true);

      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user!.id);

      const followedIds = (follows ?? []).map((f) => f.following_id as string);
      setHasFollows(followedIds.length > 0);

      if (followedIds.length === 0) {
        setFetching(false);
        return;
      }

      const { data } = await supabase
        .from("status_updates")
        .select(
          `id, caption, media_url, created_at, expires_at,
           likes_count, comments_count, views_count,
           profiles!status_updates_provider_id_fkey(id, username, avatar_url, verification_status)`
        )
        .in("provider_id", followedIds)
        .eq("post_type", "post")
        .order("created_at", { ascending: false })
        .limit(20);

      setPosts((data ?? []) as unknown as FeedPostData[]);
      setFetching(false);
    }

    load();
  }, [user, sessionLoading]);

  if (sessionLoading || fetching) return <FeedSkeleton />;
  if (!user) return <SignInPrompt />;
  if (posts.length === 0) return <EmptyFavorites hasFollows={hasFollows} />;

  return <FeedList posts={posts} />;
}
