-- ============================================================================
-- Migration 018: Comment moderation system
-- ============================================================================
-- Comments are no longer publicly visible by default. Each comment requires
-- provider approval before it appears on the public feed. Providers manage
-- pending comments from a dedicated moderation queue.
-- ============================================================================

-- 1. Add moderation columns to comments
ALTER TABLE comments
  ADD COLUMN is_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN is_rejected boolean NOT NULL DEFAULT false,
  ADD COLUMN moderated_at timestamptz;

-- Index for the provider moderation queue (pending comments on their posts)
CREATE INDEX comments_moderation_idx
  ON comments (status_update_id, is_approved, is_rejected, created_at DESC);

-- 2. Add RLS policy for providers to update (approve/reject) comments on their posts
CREATE POLICY "comments: provider moderate"
  ON comments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM status_updates su
      WHERE su.id = comments.status_update_id
        AND su.provider_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM status_updates su
      WHERE su.id = comments.status_update_id
        AND su.provider_id = auth.uid()
    )
  );

-- 3. Update get_feed_posts() to only embed APPROVED comments
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
    -- Embed latest APPROVED comments as JSONB array
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
            AND c.is_approved = true          -- only approved
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

-- 4. Update comments_count triggers to only count approved comments
--    Replace increment/decrement with a single sync function
CREATE OR REPLACE FUNCTION sync_approved_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_post_id uuid;
BEGIN
  -- Determine which post to update
  IF TG_OP = 'DELETE' THEN
    v_post_id := OLD.status_update_id;
  ELSE
    v_post_id := NEW.status_update_id;
  END IF;

  -- Recount approved comments for this post
  UPDATE status_updates
  SET comments_count = (
    SELECT count(*)
    FROM comments
    WHERE status_update_id = v_post_id
      AND is_approved = true
  )
  WHERE id = v_post_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop old triggers
DROP TRIGGER IF EXISTS on_comment_insert ON comments;
DROP TRIGGER IF EXISTS on_comment_delete ON comments;

-- New triggers: recount on insert, update (approval change), delete
CREATE TRIGGER on_comment_change
  AFTER INSERT OR UPDATE OF is_approved OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION sync_approved_comments_count();

-- 5. Helper function to get pending comments for a provider's moderation queue
CREATE OR REPLACE FUNCTION get_pending_comments(
  p_provider_id uuid,
  p_limit       integer DEFAULT 50,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE (
  comment_id        uuid,
  comment_body      text,
  comment_created   timestamptz,
  commenter_id      uuid,
  commenter_username text,
  commenter_avatar  text,
  post_id           uuid,
  post_caption      text,
  post_media_url    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id            AS comment_id,
    c.body          AS comment_body,
    c.created_at    AS comment_created,
    c.user_id       AS commenter_id,
    cp.username     AS commenter_username,
    cp.avatar_url   AS commenter_avatar,
    su.id           AS post_id,
    su.caption      AS post_caption,
    su.media_url    AS post_media_url
  FROM comments c
  JOIN profiles cp ON cp.id = c.user_id
  JOIN status_updates su ON su.id = c.status_update_id
  WHERE su.provider_id = p_provider_id
    AND c.is_approved = false
    AND c.is_rejected = false
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- 6. Function to count pending comments for a provider (for badge display)
CREATE OR REPLACE FUNCTION count_pending_comments(p_provider_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM comments c
  JOIN status_updates su ON su.id = c.status_update_id
  WHERE su.provider_id = p_provider_id
    AND c.is_approved = false
    AND c.is_rejected = false;
$$;
