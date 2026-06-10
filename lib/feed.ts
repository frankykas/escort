import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedComment {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  body: string;
  created_at: string;
}

interface FeedPost {
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
  is_premium: boolean;
  unlock_price: number | null;
  content_rating: string;
  media_path: string | null;
  latest_comments: FeedComment[];
}

interface FeedParams {
  countryCode?: string;
  city?: string;
  limit?: number;
  offset?: number;
  commentsPerPost?: number;
  /** When false (default), only SFW posts are returned (age gate). */
  allowAdult?: boolean;
}

// ---------------------------------------------------------------------------
// Get feed posts (with embedded comments)
// ---------------------------------------------------------------------------

export async function getFeedPosts(params: FeedParams = {}): Promise<FeedPost[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const {
    countryCode,
    city,
    limit = 20,
    offset = 0,
    commentsPerPost = 3,
    allowAdult = false,
  } = params;

  const { data, error } = await supabase.rpc("get_feed_posts", {
    p_country_code: countryCode ?? null,
    p_city: city ?? null,
    p_limit: limit,
    p_offset: offset,
    p_comments_per_post: commentsPerPost,
    p_allow_adult: allowAdult,
  });

  if (error) {
    console.error("Error fetching feed:", error.message);
    return [];
  }

  return (data ?? []) as FeedPost[];
}

// ---------------------------------------------------------------------------
// Add a comment to a post
// ---------------------------------------------------------------------------

interface AddCommentResult {
  success: boolean;
  commentId?: string;
  error?: string;
}

export async function addComment(
  statusUpdateId: string,
  userId: string,
  body: string,
  parentCommentId?: string
): Promise<AddCommentResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { data, error } = await supabase
    .from("comments")
    .insert({
      status_update_id: statusUpdateId,
      user_id: userId,
      body,
      parent_comment_id: parentCommentId ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, commentId: data.id };
}

// ---------------------------------------------------------------------------
// Get all comments for a post (with threading)
// ---------------------------------------------------------------------------

interface PostComment {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  body: string;
  parent_comment_id: string | null;
  created_at: string;
}

export async function getPostComments(
  statusUpdateId: string,
  limit: number = 50
): Promise<PostComment[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("comments")
    .select(`
      id,
      user_id,
      body,
      parent_comment_id,
      created_at,
      profiles:user_id (username, avatar_url)
    `)
    .eq("status_update_id", statusUpdateId)
    .eq("is_approved", true)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!data) return [];

  return data.map((row) => {
    const profile = row.profiles as unknown as { username: string; avatar_url: string | null };
    return {
      id: row.id,
      user_id: row.user_id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      body: row.body,
      parent_comment_id: row.parent_comment_id,
      created_at: row.created_at,
    };
  });
}
