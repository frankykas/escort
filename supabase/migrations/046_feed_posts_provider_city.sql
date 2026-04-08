-- ============================================================================
-- Migration 046: Add provider_city to feed RPCs
-- ============================================================================
-- The feed cards now display provider city as a location tag, so both
-- get_feed_posts and get_promoted_feed_posts need to return it.
-- ============================================================================

DROP FUNCTION IF EXISTS get_feed_posts(char, text, integer, integer, integer);

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
  provider_city     text,
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
    p.city              AS provider_city,
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
            AND c.is_approved = true
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


-- Same update for get_promoted_feed_posts
DROP FUNCTION IF EXISTS get_promoted_feed_posts(text, integer, integer);

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
  provider_city     text,
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
    p.city              AS provider_city,
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
            AND c.is_approved = true
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
    AND EXISTS (
      SELECT 1 FROM listing_bumps lb
      WHERE lb.provider_id = su.provider_id
        AND lb.tier = 3
        AND lb.is_active = true
        AND lb.expires_at > now()
    )
    AND p.city ILIKE p_city
  ORDER BY random()
  LIMIT p_limit;
END;
$$;
