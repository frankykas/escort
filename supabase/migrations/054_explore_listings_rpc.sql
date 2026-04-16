-- ============================================================================
-- Migration 054: Explore page RPCs for listing-based feed
-- ============================================================================
-- Two new RPCs:
--   1. get_bumped_listings  — active bumped listings for the premium StoriesBar
--   2. get_explore_listings — all active listings for the main feed
-- Both support geo-filtering by city.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. BUMPED LISTINGS (StoriesBar / BumpedBar)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Returns active bumped listings with provider info, filtered by city.
-- Used for the premium bar at the top of the Explore page.

CREATE OR REPLACE FUNCTION get_bumped_listings(
  p_city   text DEFAULT NULL,
  p_limit  integer DEFAULT 20
)
RETURNS TABLE (
  listing_id        uuid,
  listing_title     text,
  listing_rate      integer,
  service_type      text,
  provider_id       uuid,
  provider_username text,
  provider_avatar   text,
  provider_verified text,
  provider_city     text,
  provider_age      integer,
  bump_tier         integer,
  bump_expires_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id                  AS listing_id,
    l.title               AS listing_title,
    l.rate                AS listing_rate,
    l.service_type,
    p.id                  AS provider_id,
    p.username            AS provider_username,
    p.avatar_url          AS provider_avatar,
    p.verification_status::text AS provider_verified,
    p.city                AS provider_city,
    p.age                 AS provider_age,
    lb.tier               AS bump_tier,
    lb.expires_at         AS bump_expires_at
  FROM listing_bumps lb
  JOIN listings l ON l.id = lb.listing_id
  JOIN profiles p ON p.id = lb.provider_id
  WHERE lb.is_active = true
    AND lb.expires_at > now()
    AND l.is_active = true
    AND l.expires_at > now()
    AND p.is_posting_suspended = false
    AND (p_city IS NULL OR p.city ILIKE p_city)
  ORDER BY lb.tier DESC, lb.bumped_at DESC
  LIMIT p_limit;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. EXPLORE LISTINGS (main feed)                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Returns all active, non-expired listings with provider info.
-- Supports city filtering, category filtering, pagination.
-- Ordered by newest first (most recently created listings appear on top).

CREATE OR REPLACE FUNCTION get_explore_listings(
  p_city      text DEFAULT NULL,
  p_category  text DEFAULT NULL,
  p_limit     integer DEFAULT 20,
  p_offset    integer DEFAULT 0
)
RETURNS TABLE (
  listing_id          uuid,
  listing_title       text,
  listing_description text,
  listing_rate        integer,
  service_type        text,
  duration_minutes    integer,
  perks               text[],
  listing_created_at  timestamptz,
  provider_id         uuid,
  provider_username   text,
  provider_avatar     text,
  provider_verified   text,
  provider_city       text,
  provider_age        integer,
  is_bumped           boolean,
  bump_tier           integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id                  AS listing_id,
    l.title               AS listing_title,
    l.description         AS listing_description,
    l.rate                AS listing_rate,
    l.service_type,
    l.duration_minutes,
    l.perks,
    l.created_at          AS listing_created_at,
    p.id                  AS provider_id,
    p.username            AS provider_username,
    p.avatar_url          AS provider_avatar,
    p.verification_status::text AS provider_verified,
    p.city                AS provider_city,
    p.age                 AS provider_age,
    EXISTS (
      SELECT 1 FROM listing_bumps lb
      WHERE lb.listing_id = l.id
        AND lb.is_active = true
        AND lb.expires_at > now()
    )                     AS is_bumped,
    COALESCE(
      (SELECT MAX(lb.tier) FROM listing_bumps lb
       WHERE lb.listing_id = l.id
         AND lb.is_active = true
         AND lb.expires_at > now()),
      0
    )                     AS bump_tier
  FROM listings l
  JOIN profiles p ON p.id = l.provider_id
  WHERE l.is_active = true
    AND l.expires_at > now()
    AND p.is_posting_suspended = false
    AND (p_city IS NULL OR p.city ILIKE p_city)
    AND (p_category IS NULL OR l.service_type ILIKE p_category)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
