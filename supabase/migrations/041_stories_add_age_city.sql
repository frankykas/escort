-- ============================================================================
-- 041: Update get_active_stories RPC to include age and city
-- ============================================================================

DROP FUNCTION IF EXISTS get_active_stories(char, uuid, integer);

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
  age                 smallint,
  city                text,
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
    p.age,
    p.city,
    MAX(su.created_at)  AS latest_story_at,
    COUNT(su.id)::integer AS story_count,
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
  GROUP BY p.id, p.username, p.avatar_url, p.verification_status, p.age, p.city
  ORDER BY latest_story_at DESC
  LIMIT p_limit;
END;
$$;
