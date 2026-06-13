import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { getFeedPosts } from "@/lib/feed";
import { FeedList } from "./FeedList";
import { FeedTabs } from "./FeedTabs";
import { FavoriteFeed } from "./FavoriteFeed";
import { PublishButton } from "./PublishButton";
import { CategoryStrip } from "@/components/ui/CategoryGrid";

export type FeedPostData = {
  post_id: string;
  provider_id: string;
  provider_username: string;
  provider_avatar: string | null;
  provider_verified: string;
  provider_city?: string | null;
  provider_last_seen_at?: string | null;
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
  is_premium?: boolean;
  unlock_price?: number | null;
  content_rating?: string;
  media_path?: string | null;
  blur_url?: string | null;
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
        <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center max-w-sm">
          <p className="text-sm font-medium text-slate-600">Supabase not configured</p>
          <p className="mt-2 text-xs text-slate-400">
            Add <code className="text-pink-500">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-pink-500">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-slate-500">.env.local</code>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col flex-1 bg-[#fafbfc]">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/70 px-4 py-4 backdrop-blur-xl backdrop-saturate-150">
        <div className="flex items-center justify-center">
          <span className="text-2xl font-bold tracking-tight bg-gradient-to-r from-pink-400 to-sky-400 bg-clip-text text-transparent">Cleopatra</span>
        </div>
      </header>

      {/* Tab switcher — wrapped in Suspense because FeedTabs uses useSearchParams */}
      <Suspense fallback={<div className="h-[45px] border-b border-gray-200 bg-white" />}>
        <FeedTabs />
      </Suspense>

      {/* Category browse strip — client accounts only (providers don't reach this component) */}
      <CategoryStrip />

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
