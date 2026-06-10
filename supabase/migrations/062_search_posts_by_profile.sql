-- ============================================================================
-- Migration 062: Profile-keyword search returning a post grid
-- ============================================================================
-- Powers /search — given a query, match profiles by username (partial,
-- case-insensitive, with a bio fallback) and return a chronological grid of
-- their recent posts. Single round-trip: posts JOIN profiles, filtered +
-- ranked + paginated in SQL.
--
-- Ranking:
--   • exact username match boosted to the top
--   • prefix match next, then substring, then bio match
--   • within the matched set, posts are ordered by a (recency + engagement)
--     score so freshest, liveliest posts surface first
-- ============================================================================

-- ── Trigram extension + indexes for fast ILIKE %q% matching ────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON profiles USING gin (lower(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_bio_trgm_idx
  ON profiles USING gin (lower(coalesce(bio, '')) gin_trgm_ops);

-- Speeds up the ORDER BY su.created_at DESC after the join filter.
CREATE INDEX IF NOT EXISTS status_updates_provider_post_created_idx
  ON status_updates (provider_id, created_at DESC)
  WHERE post_type = 'post';


-- ── RPC ────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS search_posts_by_profile(text, integer, integer);

CREATE OR REPLACE FUNCTION search_posts_by_profile(
  p_query  text,
  p_limit  integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  post_id           uuid,
  provider_id       uuid,
  provider_username text,
  provider_avatar   text,
  provider_verified text,
  provider_city     text,
  caption           text,
  media_url         text,
  media_type        text,
  likes_count       integer,
  comments_count    integer,
  views_count       integer,
  created_at        timestamptz,
  match_rank        real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT lower(trim(coalesce(p_query, ''))) AS term
  ),
  matched AS (
    SELECT
      p.id,
      p.username,
      p.avatar_url,
      p.verification_status,
      p.city,
      -- Profile-level match score (higher = better)
      CASE
        WHEN lower(p.username) = (SELECT term FROM q)               THEN 1.00
        WHEN lower(p.username) LIKE (SELECT term FROM q) || '%'     THEN 0.80
        WHEN lower(p.username) LIKE '%' || (SELECT term FROM q) || '%'
                                                                    THEN 0.60
        WHEN lower(coalesce(p.bio, '')) LIKE
             '%' || (SELECT term FROM q) || '%'                     THEN 0.30
        ELSE 0.10
      END AS profile_score
    FROM profiles p, q
    WHERE q.term <> ''
      AND p.is_posting_suspended = false
      AND (
        lower(p.username)              LIKE '%' || q.term || '%'
        OR lower(coalesce(p.bio, ''))  LIKE '%' || q.term || '%'
      )
  )
  SELECT
    su.id                              AS post_id,
    m.id                               AS provider_id,
    m.username                         AS provider_username,
    m.avatar_url                       AS provider_avatar,
    m.verification_status::text        AS provider_verified,
    m.city                             AS provider_city,
    su.caption,
    su.media_url,
    su.media_type,
    su.likes_count,
    su.comments_count,
    su.views_count,
    su.created_at,
    -- Final rank = profile match weight + freshness + log(engagement).
    -- Freshness decays over ~30 days; log() keeps viral posts from dominating.
    (
      m.profile_score * 1.5
      + greatest(0, 1.0 - (extract(epoch FROM (now() - su.created_at)) / (30 * 86400)))
      + ln(1 + coalesce(su.likes_count, 0) + coalesce(su.comments_count, 0) * 2)
        / 10.0
    )::real                            AS match_rank
  FROM matched m
  JOIN status_updates su ON su.provider_id = m.id
  WHERE su.post_type = 'post'
    AND su.media_url IS NOT NULL
  ORDER BY match_rank DESC, su.created_at DESC
  LIMIT greatest(1, least(p_limit, 60))
  OFFSET greatest(0, p_offset);
$$;

GRANT EXECUTE ON FUNCTION search_posts_by_profile(text, integer, integer)
  TO anon, authenticated;
