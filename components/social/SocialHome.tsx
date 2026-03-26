import { Suspense } from "react";
import { createServerClient } from "@/lib/supabase/server";
import { FeedList } from "./FeedList";
import { FeedTabs } from "./FeedTabs";
import { FavoriteFeed } from "./FavoriteFeed";
import { PublishButton } from "./PublishButton";

export type FeedPostData = {
  id: string;
  caption: string | null;
  media_url: string | null;
  created_at: string;
  expires_at: string;
  likes_count: number;
  comments_count: number;
  views_count: number;
  profiles: {
    id: string;
    username: string;
    avatar_url: string | null;
    verification_status: "none" | "pending" | "verified";
  };
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

// Extracted to keep SocialHome clean — handles the server-side public feed fetch
async function ForYouFeed({
  supabase,
}: {
  supabase: NonNullable<ReturnType<typeof createServerClient>>;
}) {
  const { data, error } = await supabase
    .from("status_updates")
    .select(
      `id, caption, media_url, created_at, expires_at,
       likes_count, comments_count, views_count,
       profiles!status_updates_provider_id_fkey ( id, username, avatar_url, verification_status )`
    )
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <div className="max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
          <p className="text-sm font-medium text-zinc-300">Failed to load feed</p>
          <p className="mt-2 font-mono text-xs text-red-400">{error.message}</p>
          <p className="mt-3 text-xs text-zinc-600">
            If this mentions a missing column, run{" "}
            <code className="text-amber-400">003_engagement.sql</code> in your Supabase SQL Editor.
          </p>
        </div>
      </main>
    );
  }

  const posts = (data ?? []) as unknown as FeedPostData[];

  return <FeedList posts={posts} />;
}
