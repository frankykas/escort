-- ============================================================================
-- Migration 042: Bump system + first listing free
-- ============================================================================
-- Two changes:
--   1. First listing for any provider is FREE (no credit deduction).
--   2. Bump system with 3 tiers to promote listings across discovery surfaces:
--        Tier 1 (1 credit)  → Explore StoriesBar
--        Tier 2 (2 credits) → StoriesBar + SimilarProfiles
--        Tier 3 (3 credits) → StoriesBar + SimilarProfiles + Explore Feed
--      Each bump lasts 24h.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. LISTING BUMPS TABLE                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE listing_bumps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  provider_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier        integer     NOT NULL CHECK (tier IN (1, 2, 3)),
  credits_spent integer   NOT NULL CHECK (credits_spent > 0),
  bumped_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  is_active   boolean     NOT NULL DEFAULT true
);

ALTER TABLE listing_bumps ENABLE ROW LEVEL SECURITY;

-- Providers can read their own bumps
CREATE POLICY "listing_bumps: owner read"
  ON listing_bumps FOR SELECT
  USING (provider_id = auth.uid());

-- Service role can manage (creation via RPC)
CREATE POLICY "listing_bumps: service_role manage"
  ON listing_bumps FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read active bumps (needed for feed/stories/similar queries)
CREATE POLICY "listing_bumps: public read active"
  ON listing_bumps FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Indexes
CREATE INDEX listing_bumps_provider_idx
  ON listing_bumps (provider_id, expires_at DESC)
  WHERE is_active = true;

CREATE INDEX listing_bumps_active_tier_idx
  ON listing_bumps (tier, expires_at)
  WHERE is_active = true;

CREATE INDEX listing_bumps_listing_idx
  ON listing_bumps (listing_id, expires_at DESC)
  WHERE is_active = true;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. BUMP LISTING RPC                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Deducts credits based on tier, creates a bump record, and for tiers 1/2/3
-- creates a promotional story so the provider appears in the StoriesBar.

CREATE OR REPLACE FUNCTION bump_listing(
  p_provider_id  uuid,
  p_listing_id   uuid,
  p_tier         integer DEFAULT 1,
  p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id     uuid;
  v_credits_cost integer;
  v_credit_ok    boolean;
  v_bump_id      uuid;
  v_listing_title text;
  v_expires_at   timestamptz;
  v_i            integer;
BEGIN
  -- Validate tier
  IF p_tier NOT IN (1, 2, 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier. Must be 1, 2, or 3');
  END IF;

  -- Credit cost per tier
  v_credits_cost := p_tier;  -- tier 1 = 1 credit, tier 2 = 2, tier 3 = 3

  -- Verify ownership and get listing title
  SELECT provider_id, title INTO v_owner_id, v_listing_title
  FROM listings WHERE id = p_listing_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_owner_id != p_provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your listing');
  END IF;

  -- Check if provider is suspended
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  -- Check for existing active bump on this listing
  IF EXISTS (
    SELECT 1 FROM listing_bumps
    WHERE listing_id = p_listing_id
      AND is_active = true
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing already has an active bump');
  END IF;

  -- Deduct credits (one at a time using FIFO function)
  FOR v_i IN 1..v_credits_cost LOOP
    SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
    IF NOT v_credit_ok THEN
      -- Refund any already-deducted credits by adding them back
      -- This is a simplified approach; in production you might want a transaction
      IF v_i > 1 THEN
        UPDATE profiles
        SET post_credits_balance = post_credits_balance + (v_i - 1)
        WHERE id = p_provider_id;
        -- Re-credit the purchase records (simplified: just add back to newest)
        UPDATE posting_package_purchases
        SET credits_remaining = credits_remaining + (v_i - 1)
        WHERE id = (
          SELECT id FROM posting_package_purchases
          WHERE provider_id = p_provider_id
          ORDER BY purchased_at DESC
          LIMIT 1
        );
      END IF;
      RETURN jsonb_build_object('success', false, 'error',
        format('Insufficient credits. Tier %s requires %s credits', p_tier, v_credits_cost));
    END IF;
  END LOOP;

  v_expires_at := now() + (p_duration_hours || ' hours')::interval;

  -- Create the bump record
  INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, expires_at)
  VALUES (p_listing_id, p_provider_id, p_tier, v_credits_cost, v_expires_at)
  RETURNING id INTO v_bump_id;

  -- Create a promotional story so the provider appears in StoriesBar
  -- Uses the provider's avatar as the media (fetched from profile)
  INSERT INTO status_updates (
    provider_id, post_type, media_type, caption,
    media_url, expires_at, country_code
  )
  SELECT
    p_provider_id,
    'story',
    'image',
    v_listing_title,
    p.avatar_url,
    v_expires_at,
    p.country_code
  FROM profiles p
  WHERE p.id = p_provider_id;

  RETURN jsonb_build_object(
    'success', true,
    'bump_id', v_bump_id,
    'tier', p_tier,
    'credits_spent', v_credits_cost,
    'expires_at', v_expires_at
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. FIRST LISTING FREE                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Replace create_listing_with_credit to skip credit deduction when the
-- provider has zero existing listings.

CREATE OR REPLACE FUNCTION create_listing_with_credit(
  p_provider_id     uuid,
  p_title           text,
  p_description     text DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_rate            integer DEFAULT NULL,
  p_service_type    text DEFAULT NULL,
  p_perks           text[] DEFAULT '{}',
  p_duration_hours  integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id   uuid;
  v_credit_ok    boolean;
  v_listing_count integer;
  v_is_first     boolean;
BEGIN
  -- Check if provider is suspended
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  -- Count existing listings to determine if this is the first
  SELECT COUNT(*) INTO v_listing_count
  FROM listings
  WHERE provider_id = p_provider_id;

  v_is_first := (v_listing_count = 0);

  -- Deduct credit only if NOT the first listing
  IF NOT v_is_first THEN
    SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
    IF NOT v_credit_ok THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
    END IF;
  END IF;

  -- Create the listing
  INSERT INTO listings (
    provider_id, title, description, duration_minutes,
    rate, service_type, perks, expires_at
  ) VALUES (
    p_provider_id, p_title, p_description, p_duration_minutes,
    p_rate, p_service_type, p_perks,
    now() + (p_duration_hours || ' hours')::interval
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id,
    'is_first_free', v_is_first
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. BUMPED PROVIDERS IN SIMILAR PROFILES (GEO-FILTERED)                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Returns provider IDs with active tier 2/3 bumps, filtered by city.
-- SimilarProfiles passes the current profile's city so only locally-relevant
-- promoted providers appear.

CREATE OR REPLACE FUNCTION get_bumped_provider_ids(
  p_min_tier     integer DEFAULT 2,
  p_exclude_id   uuid DEFAULT NULL,
  p_city         text DEFAULT NULL,
  p_limit        integer DEFAULT 6
)
RETURNS TABLE (provider_id uuid, tier integer, listing_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (lb.provider_id)
    lb.provider_id,
    lb.tier,
    lb.listing_id
  FROM listing_bumps lb
  JOIN profiles p ON p.id = lb.provider_id
  WHERE lb.is_active = true
    AND lb.expires_at > now()
    AND lb.tier >= p_min_tier
    AND (p_exclude_id IS NULL OR lb.provider_id != p_exclude_id)
    AND (p_city IS NULL OR p.city ILIKE p_city)
  ORDER BY lb.provider_id, lb.tier DESC, lb.bumped_at DESC
  LIMIT p_limit;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. PROMOTED FEED POSTS (TIER 3, GEO-FILTERED, RANDOMIZED)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Separate query for promoted content. The client fetches this alongside the
-- organic feed and interleaves one promoted post every ~5 organic posts.
--
-- Key design decisions:
--   • Geo-filtered by city — Montreal users see Montreal bumps only
--   • Randomized order — fair rotation among competing bumps
--   • Small batch — max 6 promoted posts per feed load (enough for ~30 organic)
--   • Only returns posts from providers with active tier-3 bumps
--   • Does NOT touch get_feed_posts — organic feed stays pure chronological

CREATE OR REPLACE FUNCTION get_promoted_feed_posts(
  p_city         text,
  p_limit        integer DEFAULT 6,
  p_comments_per_post integer DEFAULT 2
)
RETURNS TABLE (
  post_id           uuid,
  provider_id       uuid,
  provider_username text,
  provider_avatar   text,
  provider_verified verification_status,
  caption           text,
  media_url         text,
  media_type        text,
  post_type         text,
  likes_count       integer,
  comments_count    integer,
  shares_count      integer,
  views_count       integer,
  created_at        timestamptz,
  latest_comments   jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    su.id               AS post_id,
    su.provider_id,
    p.username          AS provider_username,
    p.avatar_url        AS provider_avatar,
    p.verification_status AS provider_verified,
    su.caption,
    su.media_url,
    su.media_type,
    su.post_type,
    su.likes_count,
    su.comments_count,
    su.shares_count,
    su.views_count,
    su.created_at,
    COALESCE(
      (
        SELECT jsonb_agg(comment_row ORDER BY comment_row->>'created_at' ASC)
        FROM (
          SELECT jsonb_build_object(
            'id', c.id,
            'user_id', c.user_id,
            'username', cp.username,
            'avatar_url', cp.avatar_url,
            'body', c.body,
            'created_at', c.created_at
          ) AS comment_row
          FROM comments c
          JOIN profiles cp ON cp.id = c.user_id
          WHERE c.status_update_id = su.id
            AND c.parent_comment_id IS NULL
          ORDER BY c.created_at DESC
          LIMIT p_comments_per_post
        ) sub
      ),
      '[]'::jsonb
    ) AS latest_comments
  FROM status_updates su
  JOIN profiles p ON p.id = su.provider_id
  WHERE su.post_type = 'post'
    AND p.is_posting_suspended = false
    -- Only posts from providers with active tier-3 bumps in this city
    AND EXISTS (
      SELECT 1 FROM listing_bumps lb
      WHERE lb.provider_id = su.provider_id
        AND lb.tier = 3
        AND lb.is_active = true
        AND lb.expires_at > now()
    )
    AND p.city ILIKE p_city
  ORDER BY random()  -- fair rotation among competing bumps
  LIMIT p_limit;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. PLATFORM SETTINGS                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO platform_settings (key, value)
VALUES
  ('bump_duration_hours', '24'::jsonb),
  ('bump_tier_1_credits', '1'::jsonb),
  ('bump_tier_2_credits', '2'::jsonb),
  ('bump_tier_3_credits', '3'::jsonb),
  ('promoted_feed_interval', '5'::jsonb)  -- insert 1 ad every N organic posts
ON CONFLICT (key) DO NOTHING;
