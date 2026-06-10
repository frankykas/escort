import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Entitlement core — the single server-side chokepoint for the paywall.
//
// Every gated read (media routes, premium post payloads, paid DMs) MUST funnel
// through canAccessPost(). These helpers use the service-role client, so they
// must only ever be called from trusted server code (Route Handlers / lib),
// never from the client.
//
// Premium encoding (from migration 008, reused here):
//   • is_premium = false                       → public
//   • is_premium = true,  unlock_price IS NULL  → subscribers-only
//   • is_premium = true,  unlock_price NOT NULL → PPV (unlock via content_unlocks)
// ---------------------------------------------------------------------------

/** Minimal shape needed to decide access for a post. */
export interface GatedPost {
  id: string;
  provider_id: string;
  is_premium: boolean;
  unlock_price: number | null;
}

// ---------------------------------------------------------------------------
// Active subscription check
// ---------------------------------------------------------------------------

export async function hasActiveSubscription(
  viewerId: string,
  providerId: string
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  // 'cancelled' still grants access until the paid period ends (the row simply
  // won't renew). 'expired' fully revokes.
  const { data } = await supabase
    .from("subscriptions")
    .select("id, status, current_period_end")
    .eq("subscriber_id", viewerId)
    .eq("provider_id", providerId)
    .in("status", ["active", "cancelled"])
    .maybeSingle();

  if (!data) return false;

  // An active subscription with no period end is treated as valid (e.g. comped).
  if (!data.current_period_end) return data.status === "active";
  return new Date(data.current_period_end).getTime() > Date.now();
}

// ---------------------------------------------------------------------------
// All-access bundle check
// ---------------------------------------------------------------------------

/**
 * True if the viewer holds an active platform bundle (all-access pass), which
 * grants subscribers-only content across every creator. Does NOT cover PPV
 * posts/DMs or stream tickets (those remain one-off purchases).
 */
export async function hasActiveBundle(viewerId: string): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("bundle_subscriptions")
    .select("id, current_period_end")
    .eq("subscriber_id", viewerId)
    .in("status", ["active", "cancelled"])
    .limit(1)
    .maybeSingle();

  if (!data) return false;
  if (!data.current_period_end) return true;
  return new Date(data.current_period_end).getTime() > Date.now();
}

// ---------------------------------------------------------------------------
// PPV unlock check
// ---------------------------------------------------------------------------

export async function hasUnlockedPost(
  viewerId: string,
  postId: string
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("content_unlocks")
    .select("id")
    .eq("user_id", viewerId)
    .eq("content_id", postId)
    .eq("content_type", "post")
    .maybeSingle();

  return !!data;
}

// ---------------------------------------------------------------------------
// Adult-content eligibility (age gate)
// ---------------------------------------------------------------------------

/**
 * Countries where adult content is withheld regardless of opt-in, configured via
 * the ADULT_BLOCKED_COUNTRIES env var (comma-separated ISO codes, e.g. "US,GB").
 * State/province-level restrictions are a follow-up. Use uppercase ISO-3166-1.
 */
export function isAdultBlockedRegion(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  const blocked = (process.env.ADULT_BLOCKED_COUNTRIES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  return blocked.includes(countryCode.toUpperCase());
}

/**
 * True if the viewer may see suggestive/explicit content: they must be
 * age-verified (Yoti) AND have opted in to adult content. SFW content does not
 * require this — callers should short-circuit on rating === 'sfw'.
 */
export async function isAdultEligible(viewerId: string): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("profiles")
    .select("yoti_age_verified, adult_content_opt_in")
    .eq("id", viewerId)
    .maybeSingle();

  return !!data?.yoti_age_verified && !!data?.adult_content_opt_in;
}

// ---------------------------------------------------------------------------
// PPV message unlock check (paid DMs)
// ---------------------------------------------------------------------------

export async function hasUnlockedMessage(
  viewerId: string,
  messageId: string
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) return false;

  const { data } = await supabase
    .from("content_unlocks")
    .select("id")
    .eq("user_id", viewerId)
    .eq("content_id", messageId)
    .eq("content_type", "message")
    .maybeSingle();

  return !!data;
}

/** Minimal shape needed to decide access for a chat message. */
export interface GatedMessage {
  id: string;
  sender_id: string;
  is_locked: boolean;
  unlock_price: number | null;
}

/**
 * Returns true if `viewerId` may read the body/media of a (possibly locked)
 * chat message. The sender always sees their own; everyone else must have paid.
 */
export async function canAccessMessage(
  viewerId: string | null,
  message: GatedMessage
): Promise<boolean> {
  if (!message.is_locked) return true;
  if (!viewerId) return false;
  if (viewerId === message.sender_id) return true;
  return hasUnlockedMessage(viewerId, message.id);
}

// ---------------------------------------------------------------------------
// Master access decision for a single post
// ---------------------------------------------------------------------------

/**
 * Returns true if `viewerId` may view the gated media of `post`.
 * `viewerId` is null for anonymous viewers (public content only).
 */
export async function canAccessPost(
  viewerId: string | null,
  post: GatedPost
): Promise<boolean> {
  // Public content is always accessible.
  if (!post.is_premium) return true;

  // Premium content requires a known viewer.
  if (!viewerId) return false;

  // The creator always sees their own content.
  if (viewerId === post.provider_id) return true;

  // PPV post: must have purchased an individual unlock (bundles don't cover PPV).
  if (post.unlock_price != null) {
    return hasUnlockedPost(viewerId, post.id);
  }

  // Subscribers-only post: an active subscription to the creator OR an
  // all-access platform bundle grants access.
  if (await hasActiveSubscription(viewerId, post.provider_id)) return true;
  return hasActiveBundle(viewerId);
}
