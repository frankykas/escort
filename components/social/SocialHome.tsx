import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { getFeedPosts } from "@/lib/feed";
import { FeedList } from "./FeedList";
import { FeedTabs } from "./FeedTabs";
import { FavoriteFeed } from "./FavoriteFeed";
import { PublishButton } from "./PublishButton";

export type FeedPostData = {
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
  expires_at: string | null;
  latest_comments: {
    id: string;
    user_id: string;
    username: string;
    avatar_url: string | null;
    body: string;
    created_at: string;
  }[];
};

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export async function SocialHome({ searchParams }: Props) {
  const { tab } = await searchParams;
  const isFavorites = tab === "favorites";

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-zinc-300">Supabase not configured</p>
          <p className="mt-2 text-xs text-zinc-500">
            Add <code className="text-amber-400">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-amber-400">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-zinc-400">.env.local</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col flex-1 bg-zinc-950">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/70 px-4 py-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight text-amber-400">Cleopatra</span>
        </div>
      </header>

      {/* Tab switcher — wrapped in Suspense because FeedTabs uses useSearchParams */}
      <Suspense fallback={<div className="h-[45px] border-b border-zinc-800 bg-black" />}>
        <FeedTabs />
      </Suspense>

      {isFavorites ? (
        <FavoriteFeed />
      ) : (
        <ForYouFeed supabase={supabase} />
      )}

      <PublishButton />
    </main>
  );
}

// Extracted to keep SocialHome clean — handles server-side public feed fetch
async function ForYouFeed({
  supabase,
}: {
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
}) {
  const posts = await getFeedPosts();
  
  return <FeedList posts={posts} />;
}
