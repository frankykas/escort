-- =============================================================================
-- Cleopatra — Migration 075: Content Compliance & Age Gating (M4)
-- Required before any real explicit content goes live.
--   • status_updates.moderation_status — explicit posts await review
--   • content_compliance — per-explicit-post 2257-style record (attestation,
--     performer ids, consent doc, review state)
--   • get_feed_posts — age gate (p_allow_adult) + moderation gate (explicit
--     posts only appear once approved)
--
-- Age eligibility (yoti_age_verified + adult_content_opt_in, from 070/071) is
-- evaluated by the caller and passed as p_allow_adult; media reads are also
-- re-checked server-side in /api/media.
-- =============================================================================


-- ── status_updates.moderation_status ─────────────────────────────────────────
-- Non-explicit posts are auto-approved. Explicit posts start 'pending' and are
-- hidden from the feed until an admin approves them.

ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'approved'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS status_updates_moderation_idx
  ON status_updates (moderation_status) WHERE moderation_status <> 'approved';


-- ── content_compliance ───────────────────────────────────────────────────────
-- One record per explicit post. Holds the uploader's attestation, the ids of
-- everyone appearing, an optional consent document, and the review outcome.

CREATE TABLE IF NOT EXISTS content_compliance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  creator_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  performer_ids    uuid[]      NOT NULL DEFAULT '{}',
  consent_attested boolean     NOT NULL DEFAULT false,
  consent_doc_path text,
  review_status    text        NOT NULL DEFAULT 'pending'
                               CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid        REFERENCES profiles(id),
  reviewed_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id)
);

ALTER TABLE content_compliance ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS content_compliance_review_idx
  ON content_compliance (review_status) WHERE review_status = 'pending';

-- Creators can read their own compliance records. Inserts/updates and admin
-- review run through the service-role client in Route Handlers (bypass RLS).
CREATE POLICY "content_compliance: creator read own"
  ON content_compliance FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "content_compliance: creator insert own"
  ON content_compliance FOR INSERT WITH CHECK (creator_id = auth.uid());


-- ── get_feed_posts (replaces 074 version) ────────────────────────────────────
-- Adds p_allow_adult: when false, only SFW posts are returned. Explicit posts
-- are additionally hidden until moderation_status = 'approved'.

DROP FUNCTION IF EXISTS public.get_feed_posts(char(2), text, integer, integer, integer);

CREATE FUNCTION get_feed_posts(
  p_country_code char(2) DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_comments_per_post int DEFAULT 3,
  p_allow_adult boolean DEFAULT false
)
RETURNS TABLE (
  post_id uuid,
  provider_id uuid,
  provider_username text,
  provider_avatar text,
  provider_verified verification_status,
  provider_city text,
  provider_last_seen_at timestamptz,
  caption text,
  media_url text,
  media_type text,
  post_type text,
  likes_count integer,
  comments_count integer,
  shares_count integer,
  views_count integer,
  created_at timestamptz,
  expires_at timestamptz,
  is_premium boolean,
  unlock_price integer,
  content_rating text,
  media_path text,
  latest_comments jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH feed AS (
    SELECT
      su.id,
      su.provider_id,
      su.caption,
      su.media_url,
      su.media_type,
      su.post_type,
      su.likes_count,
      su.comments_count,
      COALESCE(su.shares_count, 0) AS shares_count,
      COALESCE(su.views_count, 0) AS views_count,
      su.created_at,
      su.expires_at,
      COALESCE(su.is_premium, false) AS is_premium,
      su.unlock_price,
      COALESCE(su.content_rating, 'sfw') AS content_rating,
      su.media_path,
      p.username,
      p.avatar_url,
      p.verification_status,
      p.city,
      p.last_seen_at
    FROM status_updates su
    JOIN profiles p ON p.id = su.provider_id
    WHERE su.post_type = 'post'
      AND (su.expires_at IS NULL OR su.expires_at > now())
      AND (su.scheduled_at IS NULL OR su.scheduled_at <= now())
      AND (p_country_code IS NULL OR su.country_code = p_country_code)
      AND (p_city IS NULL OR lower(p.city) = lower(p_city))
      AND p.is_posting_suspended = false
      -- Age gate: hide non-SFW unless the viewer is eligible for adult content.
      AND (COALESCE(su.content_rating, 'sfw') = 'sfw' OR p_allow_adult)
      -- Moderation gate: explicit posts must be approved to appear.
      AND (COALESCE(su.content_rating, 'sfw') <> 'explicit'
           OR COALESCE(su.moderation_status, 'approved') = 'approved')
    ORDER BY su.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT
    f.id,
    f.provider_id,
    f.username,
    f.avatar_url,
    f.verification_status,
    f.city,
    f.last_seen_at,
    f.caption,
    CASE WHEN f.is_premium THEN NULL ELSE f.media_url END,
    f.media_type,
    f.post_type,
    f.likes_count,
    f.comments_count,
    f.shares_count,
    f.views_count,
    f.created_at,
    f.expires_at,
    f.is_premium,
    f.unlock_price,
    f.content_rating,
    f.media_path,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'user_id', c.user_id,
          'username', cp.username,
          'avatar_url', cp.avatar_url,
          'body', c.body,
          'created_at', c.created_at
        )
        ORDER BY c.created_at DESC
      )
      FROM (
        SELECT *
        FROM comments
        WHERE status_update_id = f.id
          AND parent_comment_id IS NULL
          AND is_approved = true
        ORDER BY created_at DESC
        LIMIT p_comments_per_post
      ) c
      JOIN profiles cp ON cp.id = c.user_id
    ), '[]'::jsonb)
  FROM feed f;
$$;
