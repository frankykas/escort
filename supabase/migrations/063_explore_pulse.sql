-- ============================================================================
-- Migration 063: Explore "live pulse" stats
-- ============================================================================
-- Powers the rotating live-stats strip under the Explorer title:
--   • online_count   — providers active in the last 15 minutes
--   • new_today      — posts created today (since local midnight, UTC-based)
--   • latest_event   — newest "live moment" in the last hour: a star
--                      activation, a fresh post, or a profile that just
--                      came online. Returned as `{ kind, username, ago_min }`.
--
-- All three fields are scoped by city when p_city is non-empty; otherwise
-- they're computed across the whole platform.
--
-- One round-trip, one tiny payload — meant to poll cheaply (every ~30s).
-- ============================================================================

DROP FUNCTION IF EXISTS get_explore_pulse(text);

CREATE OR REPLACE FUNCTION get_explore_pulse(p_city text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(trim(coalesce(p_city, '')), '') AS city_filter,
      now() - interval '15 minutes' AS online_cutoff,
      date_trunc('day', now())      AS day_start,
      now() - interval '1 hour'     AS event_cutoff
  ),
  online AS (
    SELECT count(*)::int AS n
    FROM profiles p, params q
    WHERE p.is_provider = true
      AND p.is_posting_suspended = false
      AND p.last_seen_at >= q.online_cutoff
      AND (q.city_filter IS NULL OR lower(coalesce(p.city, '')) = lower(q.city_filter))
  ),
  new_today AS (
    SELECT count(*)::int AS n
    FROM status_updates su
    JOIN profiles p ON p.id = su.provider_id
    , params q
    WHERE su.post_type = 'post'
      AND su.created_at >= q.day_start
      AND (q.city_filter IS NULL OR lower(coalesce(p.city, '')) = lower(q.city_filter))
  ),
  -- Latest "live moment" — pick the freshest of three event sources.
  events AS (
    -- Star activations
    SELECT
      'star'::text                                       AS kind,
      p.username                                         AS username,
      ls.starred_at                                      AS at
    FROM listing_stars ls
    JOIN profiles p ON p.id = ls.provider_id
    , params q
    WHERE ls.is_active = true
      AND ls.starred_at >= q.event_cutoff
      AND (q.city_filter IS NULL OR lower(coalesce(p.city, '')) = lower(q.city_filter))

    UNION ALL

    -- Fresh posts
    SELECT
      'post'::text                                       AS kind,
      p.username                                         AS username,
      su.created_at                                      AS at
    FROM status_updates su
    JOIN profiles p ON p.id = su.provider_id
    , params q
    WHERE su.post_type = 'post'
      AND su.created_at >= q.event_cutoff
      AND (q.city_filter IS NULL OR lower(coalesce(p.city, '')) = lower(q.city_filter))

    UNION ALL

    -- Came online (last_seen flipped within the window)
    SELECT
      'online'::text                                     AS kind,
      p.username                                         AS username,
      p.last_seen_at                                     AS at
    FROM profiles p, params q
    WHERE p.is_provider = true
      AND p.is_posting_suspended = false
      AND p.last_seen_at >= q.event_cutoff
      AND (q.city_filter IS NULL OR lower(coalesce(p.city, '')) = lower(q.city_filter))
  ),
  latest_event AS (
    SELECT kind, username, at
    FROM events
    ORDER BY at DESC
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'online_count',   (SELECT n FROM online),
    'new_today',      (SELECT n FROM new_today),
    'latest_event',   (
      SELECT jsonb_build_object(
        'kind',     kind,
        'username', username,
        'ago_min',  greatest(0, floor(extract(epoch FROM (now() - at)) / 60))::int
      )
      FROM latest_event
    ),
    'city',           (SELECT city_filter FROM params)
  );
$$;

GRANT EXECUTE ON FUNCTION get_explore_pulse(text) TO anon, authenticated;
