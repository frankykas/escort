import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostAnalytics {
  post_id: string;
  post_type: string;
  caption: string | null;
  created_at: string;
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_last_24h: number;
  views_last_7d: number;
}

interface ProviderStats {
  totalPosts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  creditsRemaining: number;
  activeStories: number;
}

// ---------------------------------------------------------------------------
// Get analytics for a provider's posts
// ---------------------------------------------------------------------------

export async function getProviderPostAnalytics(
  providerId: string,
  limit: number = 20,
  offset: number = 0
): Promise<PostAnalytics[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("provider_post_analytics")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching post analytics:", error.message);
    return [];
  }

  return (data ?? []) as PostAnalytics[];
}

// ---------------------------------------------------------------------------
// Get aggregate stats for a provider
// ---------------------------------------------------------------------------

export async function getProviderStats(providerId: string): Promise<ProviderStats> {
  const supabase = createServerClient();
  if (!supabase) {
    return {
      totalPosts: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      creditsRemaining: 0,
      activeStories: 0,
    };
  }

  // Fetch all data in parallel
  const [postsResult, profileResult, storiesResult] = await Promise.all([
    // Aggregate post stats
    supabase
      .from("status_updates")
      .select("views_count, likes_count, comments_count, shares_count")
      .eq("provider_id", providerId)
      .eq("post_type", "post"),

    // Credit balance
    supabase
      .from("profiles")
      .select("post_credits_balance")
      .eq("id", providerId)
      .single(),

    // Active stories count
    supabase
      .from("status_updates")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", providerId)
      .eq("post_type", "story")
      .gt("expires_at", new Date().toISOString()),
  ]);

  const posts = postsResult.data ?? [];

  return {
    totalPosts: posts.length,
    totalViews: posts.reduce((sum, p) => sum + (p.views_count ?? 0), 0),
    totalLikes: posts.reduce((sum, p) => sum + (p.likes_count ?? 0), 0),
    totalComments: posts.reduce((sum, p) => sum + (p.comments_count ?? 0), 0),
    totalShares: posts.reduce((sum, p) => sum + (p.shares_count ?? 0), 0),
    creditsRemaining: profileResult.data?.post_credits_balance ?? 0,
    activeStories: storiesResult.count ?? 0,
  };
}
