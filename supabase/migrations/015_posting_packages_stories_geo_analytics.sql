-- =============================================================================
-- Cleopatra — Migration 015: Posting Packages, Stories, Geo, Analytics, Admin
--
-- Covers:
--   1. Posting packages (revenue engine) + credit tracking
--   2. Stories system (post_type enum, separate stories from feed posts)
--   3. Provider location opt-in
--   4. Proximity search function (PostGIS radius-based)
--   5. Post cooldown / rate limiting
--   6. Post view tracking (provider analytics)
--   7. Admin controls (posting suspension, package management)
--   8. Country-level default feed support
-- =============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. POSTING PACKAGES — Revenue Engine                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Product catalog: what posting packages can be purchased
CREATE TABLE posting_packages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  description     text,
  post_credits    integer     NOT NULL CHECK (post_credits > 0),
  price           integer     NOT NULL CHECK (price > 0),      -- cents
  validity_days   integer,                                      -- NULL = credits never expire
  is_active       boolean     NOT NULL DEFAULT true,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posting_packages ENABLE ROW LEVEL SECURITY;

-- Anyone can see active packages
CREATE POLICY "posting_packages: public read active"
  ON posting_packages FOR SELECT
  USING (is_active = true);

-- Only service_role can manage packages (admin via API)
CREATE POLICY "posting_packages: service_role manage"
  ON posting_packages FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- Purchase records: what providers have bought
CREATE TABLE posting_package_purchases (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id               uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_id                uuid        REFERENCES posting_packages(id),
  credits_purchased         integer     NOT NULL CHECK (credits_purchased > 0),
  credits_remaining         integer     NOT NULL CHECK (credits_remaining >= 0),
  stripe_payment_intent_id  text,
  purchased_at              timestamptz NOT NULL DEFAULT now(),
  expires_at                timestamptz           -- NULL = never expires
);

ALTER TABLE posting_package_purchases ENABLE ROW LEVEL SECURITY;

-- Providers can read their own purchases
CREATE POLICY "posting_package_purchases: owner read"
  ON posting_package_purchases FOR SELECT
  USING (provider_id = auth.uid());

-- Providers can insert (purchase flow)
CREATE POLICY "posting_package_purchases: owner insert"
  ON posting_package_purchases FOR INSERT
  WITH CHECK (provider_id = auth.uid());

-- Only service_role can update credits (deduction happens server-side)
CREATE POLICY "posting_package_purchases: service_role update"
  ON posting_package_purchases FOR UPDATE
  USING (auth.role() = 'service_role');

-- Index for fast credit balance lookups
CREATE INDEX posting_purchases_provider_idx
  ON posting_package_purchases (provider_id, credits_remaining)
  WHERE credits_remaining > 0;


-- ── Denormalized credit balance on profiles ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS post_credits_balance integer NOT NULL DEFAULT 0;


-- ── Function: deduct one post credit ─────────────────────────────────────────
-- Called server-side when a provider creates a post.
-- Deducts from the oldest non-expired purchase with remaining credits (FIFO).
-- Returns TRUE if deduction succeeded, FALSE if insufficient credits.

CREATE OR REPLACE FUNCTION deduct_post_credit(p_provider_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_id uuid;
BEGIN
  -- Find oldest purchase with remaining credits that hasn't expired
  SELECT id INTO purchase_id
  FROM posting_package_purchases
  WHERE provider_id = p_provider_id
    AND credits_remaining > 0
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF purchase_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Deduct one credit
  UPDATE posting_package_purchases
  SET credits_remaining = credits_remaining - 1
  WHERE id = purchase_id;

  -- Update denormalized balance
  UPDATE profiles
  SET post_credits_balance = GREATEST(post_credits_balance - 1, 0)
  WHERE id = p_provider_id;

  RETURN TRUE;
END;
$$;


-- ── Trigger: update denormalized balance on purchase ─────────────────────────
CREATE OR REPLACE FUNCTION sync_post_credits_balance_on_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET post_credits_balance = post_credits_balance + NEW.credits_purchased
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_posting_package_purchase
  AFTER INSERT ON posting_package_purchases
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_credits_balance_on_purchase();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. STORIES SYSTEM — Proper Instagram-style stories                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Add post_type to distinguish feed posts from stories
-- 'post' = permanent feed post (uses a credit, appears in feed, no auto-expiry)
-- 'story' = ephemeral 24h story (free, appears in stories bar, auto-expires)
ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'post'
    CHECK (post_type IN ('post', 'story'));

-- Stories get media_type for richer content (image, video, text-overlay)
ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image'
    CHECK (media_type IN ('image', 'video', 'text'));

-- Track whether a story has been viewed by a specific user
CREATE TABLE story_views (
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_id          uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  viewed_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- Providers can see who viewed their stories
CREATE POLICY "story_views: provider read"
  ON story_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM status_updates
      WHERE id = story_id AND provider_id = auth.uid()
    )
  );

-- Users can see their own view history
CREATE POLICY "story_views: viewer read own"
  ON story_views FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own views
CREATE POLICY "story_views: viewer insert"
  ON story_views FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Index for fast "has user seen this story" lookups
CREATE INDEX story_views_user_idx ON story_views (user_id, story_id);

-- Index for provider analytics: who viewed my stories
CREATE INDEX story_views_story_idx ON story_views (story_id, viewed_at DESC);

-- Index for feed queries: quickly find active stories vs posts
CREATE INDEX status_updates_post_type_idx
  ON status_updates (post_type, provider_id, created_at DESC);

-- For stories: quickly find stories ordered by recency
-- (expiry filtering happens at query time, not in the index predicate,
--  because now() is not IMMUTABLE)
CREATE INDEX status_updates_stories_idx
  ON status_updates (created_at DESC)
  WHERE post_type = 'story';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. PROVIDER LOCATION OPT-IN                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Providers must explicitly enable location sharing to appear in geo results
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location_sharing_enabled boolean NOT NULL DEFAULT false;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. PROXIMITY SEARCH — PostGIS radius-based filtering                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Function: find providers within a radius, sorted by latest post
-- Returns provider profiles ordered by their most recent post (recency > proximity)
-- Only includes providers who have opted in to location sharing

CREATE OR REPLACE FUNCTION find_providers_nearby(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8 DEFAULT 50.0,
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  provider_id         uuid,
  username            text,
  avatar_url          text,
  city                text,
  distance_km         float8,
  latest_post_at      timestamptz,
  verification_status verification_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                AS provider_id,
    p.username,
    p.avatar_url,
    p.city,
    ROUND(
      (ST_Distance(
        l.last_known_coords,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) / 1000.0)::numeric
    , 1)::float8        AS distance_km,
    (
      SELECT MAX(su.created_at)
      FROM status_updates su
      WHERE su.provider_id = p.id
        AND su.post_type = 'post'
    )                   AS latest_post_at,
    p.verification_status
  FROM profiles p
  JOIN locations l ON l.profile_id = p.id
  WHERE p.is_provider = true
    AND p.location_sharing_enabled = true
    AND ST_DWithin(
      l.last_known_coords,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_km * 1000  -- ST_DWithin uses meters
    )
  ORDER BY latest_post_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;


-- Function: find providers by city, sorted by latest post
CREATE OR REPLACE FUNCTION find_providers_by_city(
  p_city    text,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  provider_id         uuid,
  username            text,
  avatar_url          text,
  city                text,
  latest_post_at      timestamptz,
  verification_status verification_status
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                AS provider_id,
    p.username,
    p.avatar_url,
    p.city,
    (
      SELECT MAX(su.created_at)
      FROM status_updates su
      WHERE su.provider_id = p.id
        AND su.post_type = 'post'
    )                   AS latest_post_at,
    p.verification_status
  FROM profiles p
  WHERE p.is_provider = true
    AND p.city ILIKE p_city
  ORDER BY latest_post_at DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. POST COOLDOWN / RATE LIMITING                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Configurable cooldown stored in a platform settings table
-- Default: 6 hours between feed posts (stories are unlimited)

CREATE TABLE IF NOT EXISTS platform_settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "platform_settings: public read"
  ON platform_settings FOR SELECT
  USING (true);

-- Only service_role can manage
CREATE POLICY "platform_settings: service_role manage"
  ON platform_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed default cooldown
INSERT INTO platform_settings (key, value)
VALUES ('post_cooldown_hours', '6'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Function: check if provider can post (respects cooldown)
-- Returns TRUE if the provider can post, FALSE if they're still in cooldown
CREATE OR REPLACE FUNCTION can_provider_post(p_provider_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cooldown_hours integer;
  last_post_at   timestamptz;
BEGIN
  -- Check if provider is suspended
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN FALSE;
  END IF;

  -- Get cooldown setting
  SELECT (value)::integer INTO cooldown_hours
  FROM platform_settings
  WHERE key = 'post_cooldown_hours';

  IF cooldown_hours IS NULL OR cooldown_hours <= 0 THEN
    RETURN TRUE;
  END IF;

  -- Check last feed post (stories don't count)
  SELECT MAX(created_at) INTO last_post_at
  FROM status_updates
  WHERE provider_id = p_provider_id
    AND post_type = 'post';

  IF last_post_at IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN (now() - last_post_at) >= make_interval(hours => cooldown_hours);
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. POST VIEW TRACKING — Provider Analytics                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Track individual post views for analytics
CREATE TABLE post_views (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status_update_id  uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  viewer_id         uuid        REFERENCES profiles(id) ON DELETE SET NULL,  -- NULL = anonymous
  viewer_ip_hash    text,       -- hashed IP for anonymous dedup
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;

-- Providers can read views on their own posts
CREATE POLICY "post_views: provider read own"
  ON post_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM status_updates
      WHERE id = status_update_id AND provider_id = auth.uid()
    )
  );

-- Anyone can insert a view (tracked server-side)
CREATE POLICY "post_views: service_role insert"
  ON post_views FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can also record their own views
CREATE POLICY "post_views: authenticated insert"
  ON post_views FOR INSERT
  WITH CHECK (viewer_id = auth.uid());

-- Index for analytics: views per post over time
CREATE INDEX post_views_post_idx ON post_views (status_update_id, created_at DESC);

-- Index for dedup: prevent counting same viewer twice quickly
CREATE INDEX post_views_dedup_idx ON post_views (status_update_id, viewer_id)
  WHERE viewer_id IS NOT NULL;

-- Trigger: auto-increment views_count on status_updates
CREATE OR REPLACE FUNCTION increment_post_views_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE status_updates
  SET views_count = views_count + 1
  WHERE id = NEW.status_update_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_post_view_insert
  AFTER INSERT ON post_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_views_count();


-- ── Provider analytics summary view ─────────────────────────────────────────
-- Quick stats for provider dashboard

CREATE OR REPLACE VIEW provider_post_analytics AS
SELECT
  su.provider_id,
  su.id                AS post_id,
  su.post_type,
  su.caption,
  su.created_at,
  su.views_count,
  su.likes_count,
  su.comments_count,
  su.shares_count,
  -- Views in last 24h
  (
    SELECT COUNT(*)
    FROM post_views pv
    WHERE pv.status_update_id = su.id
      AND pv.created_at > now() - interval '24 hours'
  ) AS views_last_24h,
  -- Views in last 7 days
  (
    SELECT COUNT(*)
    FROM post_views pv
    WHERE pv.status_update_id = su.id
      AND pv.created_at > now() - interval '7 days'
  ) AS views_last_7d
FROM status_updates su
WHERE su.post_type = 'post';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. ADMIN CONTROLS                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Posting suspension flag on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_posting_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS posting_suspended_reason text,
  ADD COLUMN IF NOT EXISTS posting_suspended_at timestamptz;

-- Admin audit log for moderation actions
CREATE TABLE admin_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  action_type   text        NOT NULL CHECK (action_type IN (
    'suspend_posting', 'unsuspend_posting',
    'delete_post', 'hide_post',
    'create_package', 'update_package', 'deactivate_package',
    'grant_credits', 'revoke_credits',
    'update_setting'
  )),
  target_id     uuid,       -- profile_id, post_id, or package_id depending on action
  details       jsonb,      -- additional context
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write admin actions
CREATE POLICY "admin_actions: service_role manage"
  ON admin_actions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX admin_actions_target_idx ON admin_actions (target_id, created_at DESC);
CREATE INDEX admin_actions_type_idx ON admin_actions (action_type, created_at DESC);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  8. COUNTRY-LEVEL DEFAULT FEED                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Add country_code to status_updates so feed can be filtered by country
-- Populated from the provider's profile.country_code at post time
ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS country_code char(2);

-- Index for country-scoped feed queries
CREATE INDEX status_updates_country_feed_idx
  ON status_updates (country_code, created_at DESC)
  WHERE post_type = 'post';

-- Function: get feed posts with comments (for the "comments visible on feed" requirement)
-- Returns posts with their latest N comments pre-loaded
CREATE OR REPLACE FUNCTION get_feed_posts(
  p_country_code char(2) DEFAULT NULL,
  p_city         text     DEFAULT NULL,
  p_limit        integer  DEFAULT 20,
  p_offset       integer  DEFAULT 0,
  p_comments_per_post integer DEFAULT 3
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
    -- Embed latest comments as JSONB array
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
            AND c.parent_comment_id IS NULL  -- top-level only
          ORDER BY c.created_at DESC
          LIMIT p_comments_per_post
        ) sub
      ),
      '[]'::jsonb
    ) AS latest_comments
  FROM status_updates su
  JOIN profiles p ON p.id = su.provider_id
  WHERE su.post_type = 'post'
    AND (p_country_code IS NULL OR su.country_code = p_country_code)
    AND (p_city IS NULL OR p.city ILIKE p_city)
    AND p.is_posting_suspended = false
  ORDER BY su.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


-- Function: get active stories for the stories bar
-- Returns one row per provider who has active (unexpired) stories,
-- ordered by most recent story first
CREATE OR REPLACE FUNCTION get_active_stories(
  p_country_code char(2) DEFAULT NULL,
  p_viewer_id    uuid     DEFAULT NULL,
  p_limit        integer  DEFAULT 30
)
RETURNS TABLE (
  provider_id         uuid,
  username            text,
  avatar_url          text,
  verification_status verification_status,
  latest_story_at     timestamptz,
  story_count         integer,
  has_unseen          boolean,
  stories             jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id                AS provider_id,
    p.username,
    p.avatar_url,
    p.verification_status,
    MAX(su.created_at)  AS latest_story_at,
    COUNT(su.id)::integer AS story_count,
    -- Check if viewer has unseen stories from this provider
    CASE
      WHEN p_viewer_id IS NULL THEN true
      ELSE EXISTS (
        SELECT 1 FROM status_updates s2
        WHERE s2.provider_id = p.id
          AND s2.post_type = 'story'
          AND s2.expires_at > now()
          AND NOT EXISTS (
            SELECT 1 FROM story_views sv
            WHERE sv.story_id = s2.id AND sv.user_id = p_viewer_id
          )
      )
    END                 AS has_unseen,
    -- All active stories for this provider
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', su.id,
          'media_url', su.media_url,
          'media_type', su.media_type,
          'caption', su.caption,
          'created_at', su.created_at,
          'expires_at', su.expires_at,
          'views_count', su.views_count
        )
        ORDER BY su.created_at ASC
      ),
      '[]'::jsonb
    ) AS stories
  FROM status_updates su
  JOIN profiles p ON p.id = su.provider_id
  WHERE su.post_type = 'story'
    AND su.expires_at > now()
    AND p.is_posting_suspended = false
    AND (p_country_code IS NULL OR su.country_code = p_country_code)
  GROUP BY p.id, p.username, p.avatar_url, p.verification_status
  ORDER BY latest_story_at DESC
  LIMIT p_limit;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SEED: Default posting packages                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO posting_packages (name, description, post_credits, price, validity_days, sort_order)
VALUES
  ('Starter',     '10 posts to get started',                10,   3999,  30,  0),
  ('Popular',     '30 posts — our most popular package',    30,  9999,  30,  1),
  ('Pro',         '75 posts for power users',               75,  19999, 60,  2),
  ('Unlimited',   '200 posts for maximum visibility',      200,  39999, 90,  3)
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  SEED: Default platform settings                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO platform_settings (key, value)
VALUES
  ('default_country_code', '"CA"'::jsonb),           -- Canada as default feed
  ('story_duration_hours', '24'::jsonb),             -- Stories last 24h
  ('max_stories_per_day', '10'::jsonb),              -- Max stories per provider per day
  ('min_post_media_required', 'true'::jsonb)         -- Posts must include media
ON CONFLICT (key) DO NOTHING;
