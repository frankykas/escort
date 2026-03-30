import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateStoryParams {
  providerId: string;
  mediaUrl: string;
  mediaType?: "image" | "video" | "text";
  caption?: string;
  countryCode?: string;
}

interface CreateStoryResult {
  success: boolean;
  storyId?: string;
  error?: string;
}

interface StoryGroup {
  provider_id: string;
  username: string;
  avatar_url: string | null;
  verification_status: string;
  latest_story_at: string;
  story_count: number;
  has_unseen: boolean;
  stories: StoryItem[];
}

interface StoryItem {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  created_at: string;
  expires_at: string;
  views_count: number;
}

// ---------------------------------------------------------------------------
// Create a story (free, expires in 24h)
// ---------------------------------------------------------------------------

export async function createStory(params: CreateStoryParams): Promise<CreateStoryResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { providerId, mediaUrl, mediaType = "image", caption, countryCode } = params;

  // Check if provider is suspended
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_posting_suspended")
    .eq("id", providerId)
    .single();

  if (profile?.is_posting_suspended) {
    return { success: false, error: "Posting has been suspended for this account" };
  }

  // Check daily story limit
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "max_stories_per_day")
    .single();

  const maxPerDay = setting ? Number(setting.value) : 10;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from("status_updates")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", providerId)
    .eq("post_type", "story")
    .gte("created_at", twentyFourHoursAgo);

  if ((count ?? 0) >= maxPerDay) {
    return { success: false, error: `Maximum ${maxPerDay} stories per day` };
  }

  // Create the story (24h expiry)
  const { data: story, error } = await supabase
    .from("status_updates")
    .insert({
      provider_id: providerId,
      caption,
      media_url: mediaUrl,
      media_type: mediaType,
      post_type: "story",
      country_code: countryCode,
      // expires_at defaults to now() + 24h in the DB
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, storyId: story.id };
}

// ---------------------------------------------------------------------------
// Get active stories (grouped by provider, with unseen tracking)
// ---------------------------------------------------------------------------

export async function getActiveStories(
  viewerId?: string,
  countryCode?: string,
  limit: number = 30
): Promise<StoryGroup[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("get_active_stories", {
    p_country_code: countryCode ?? null,
    p_viewer_id: viewerId ?? null,
    p_limit: limit,
  });

  if (error) {
    console.error("Error fetching stories:", error.message);
    return [];
  }

  return (data ?? []) as StoryGroup[];
}

// ---------------------------------------------------------------------------
// Mark a story as viewed
// ---------------------------------------------------------------------------

export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  await supabase
    .from("story_views")
    .upsert(
      { user_id: userId, story_id: storyId },
      { onConflict: "user_id,story_id" }
    );
}

// ---------------------------------------------------------------------------
// Get story viewers (for providers)
// ---------------------------------------------------------------------------

export async function getStoryViewers(
  storyId: string,
  limit: number = 50
): Promise<{ userId: string; username: string; avatarUrl: string | null; viewedAt: string }[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("story_views")
    .select(`
      user_id,
      viewed_at,
      profiles:user_id (username, avatar_url)
    `)
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => {
    const profile = row.profiles as unknown as { username: string; avatar_url: string | null };
    return {
      userId: row.user_id,
      username: profile.username,
      avatarUrl: profile.avatar_url,
      viewedAt: row.viewed_at,
    };
  });
}
