import { createServerClient } from "@/lib/supabase/server";
import { USE_POSTING_PACKAGES, USE_POST_COOLDOWN } from "@/lib/features";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreatePostParams {
  providerId: string;
  caption: string;
  mediaUrl: string;
  mediaType?: "image" | "video" | "text";
  countryCode?: string;
}

interface CreatePostResult {
  success: boolean;
  postId?: string;
  error?: string;
  cooldownRemainingMinutes?: number;
}

interface PostCooldownStatus {
  canPost: boolean;
  cooldownRemainingMinutes: number;
  lastPostAt: string | null;
}

// ---------------------------------------------------------------------------
// Create a feed post (with credit + cooldown enforcement)
// ---------------------------------------------------------------------------

export async function createPost(params: CreatePostParams): Promise<CreatePostResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { providerId, caption, mediaUrl, mediaType = "image", countryCode } = params;

  // 1. Check if provider is suspended
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_posting_suspended")
    .eq("id", providerId)
    .single();

  if (profile?.is_posting_suspended) {
    return { success: false, error: "Posting has been suspended for this account" };
  }

  // 2. Check cooldown (if feature enabled)
  if (USE_POST_COOLDOWN) {
    const cooldown = await checkPostCooldown(providerId);
    if (!cooldown.canPost) {
      return {
        success: false,
        error: `Please wait before posting again`,
        cooldownRemainingMinutes: cooldown.cooldownRemainingMinutes,
      };
    }
  }

  // 3. Check & deduct credit (if feature enabled)
  if (USE_POSTING_PACKAGES) {
    const { data: creditResult } = await supabase.rpc("deduct_post_credit", {
      p_provider_id: providerId,
    });

    if (!creditResult) {
      return {
        success: false,
        error: "Insufficient post credits. Purchase a posting package to continue.",
      };
    }
  }

  // 4. Create the post
  const { data: post, error } = await supabase
    .from("status_updates")
    .insert({
      provider_id: providerId,
      caption,
      media_url: mediaUrl,
      media_type: mediaType,
      post_type: "post",
      country_code: countryCode,
      expires_at: null, // Feed posts don't expire
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, postId: post.id };
}

// ---------------------------------------------------------------------------
// Check post cooldown status
// ---------------------------------------------------------------------------

export async function checkPostCooldown(providerId: string): Promise<PostCooldownStatus> {
  const supabase = createServerClient();
  if (!supabase) {
    return { canPost: false, cooldownRemainingMinutes: 0, lastPostAt: null };
  }

  // Get cooldown setting
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "post_cooldown_hours")
    .single();

  const cooldownHours = setting ? Number(setting.value) : 6;

  // Get last post time
  const { data: lastPost } = await supabase
    .from("status_updates")
    .select("created_at")
    .eq("provider_id", providerId)
    .eq("post_type", "post")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!lastPost) {
    return { canPost: true, cooldownRemainingMinutes: 0, lastPostAt: null };
  }

  const lastPostAt = new Date(lastPost.created_at);
  const cooldownEnd = new Date(lastPostAt.getTime() + cooldownHours * 60 * 60 * 1000);
  const now = new Date();

  if (now >= cooldownEnd) {
    return { canPost: true, cooldownRemainingMinutes: 0, lastPostAt: lastPost.created_at };
  }

  const remainingMs = cooldownEnd.getTime() - now.getTime();
  const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));

  return {
    canPost: false,
    cooldownRemainingMinutes: remainingMinutes,
    lastPostAt: lastPost.created_at,
  };
}

// ---------------------------------------------------------------------------
// Record a post view (deduped per viewer)
// ---------------------------------------------------------------------------

export async function recordPostView(
  statusUpdateId: string,
  viewerId: string | null
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) return;

  if (viewerId) {
    // Deduplicate: only count one view per user per post
    const { data: existing } = await supabase
      .from("post_views")
      .select("id")
      .eq("status_update_id", statusUpdateId)
      .eq("viewer_id", viewerId)
      .limit(1)
      .single();

    if (existing) return;
  }

  await supabase.from("post_views").insert({
    status_update_id: statusUpdateId,
    viewer_id: viewerId,
  });
}
