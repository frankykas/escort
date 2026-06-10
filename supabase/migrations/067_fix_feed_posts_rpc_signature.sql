-- Fix ambiguous get_feed_posts overloads introduced while adding feed activity.
-- Keep a single char(2) country-code signature, matching earlier migrations.

DROP FUNCTION IF EXISTS public.get_feed_posts(char, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_feed_posts(text, text, integer, integer, integer);

CREATE OR REPLACE FUNCTION get_feed_posts(
  p_country_code char(2) DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_comments_per_post int DEFAULT 3
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
    f.media_url,
    f.media_type,
    f.post_type,
    f.likes_count,
    f.comments_count,
    f.shares_count,
    f.views_count,
    f.created_at,
    f.expires_at,
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
