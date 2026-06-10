-- Add provider_last_seen_at to Explore listing RPCs so cards can show Active badges.

DROP FUNCTION IF EXISTS public.get_bumped_listings(text, integer);
DROP FUNCTION IF EXISTS public.get_explore_listings(text, text, integer, integer);
DROP FUNCTION IF EXISTS public.get_starred_listings(text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_bumped_listings(
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
  provider_last_seen_at timestamptz,
  bump_tier         integer,
  bump_expires_at   timestamptz,
  images            jsonb
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
    p.last_seen_at        AS provider_last_seen_at,
    lb.tier               AS bump_tier,
    lb.expires_at         AS bump_expires_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('url', li.url, 'sort_order', li.sort_order) ORDER BY li.sort_order)
       FROM listing_images li WHERE li.listing_id = l.id),
      '[]'::jsonb
    ) AS images
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

CREATE OR REPLACE FUNCTION public.get_explore_listings(
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
  provider_last_seen_at timestamptz,
  is_bumped           boolean,
  bump_tier           integer,
  images              jsonb
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
    p.last_seen_at        AS provider_last_seen_at,
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
    )                     AS bump_tier,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('url', li.url, 'sort_order', li.sort_order) ORDER BY li.sort_order)
       FROM listing_images li WHERE li.listing_id = l.id),
      '[]'::jsonb
    ) AS images
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

CREATE OR REPLACE FUNCTION public.get_starred_listings(
  p_city   text    DEFAULT NULL,
  p_seed   integer DEFAULT 0,
  p_limit  integer DEFAULT 6
)
RETURNS TABLE (
  listing_id        uuid,
  listing_title     text,
  listing_rate      integer,
  service_type      text,
  duration_minutes  integer,
  provider_id       uuid,
  provider_username text,
  provider_avatar   text,
  provider_verified text,
  provider_city     text,
  provider_age      smallint,
  provider_last_seen_at timestamptz,
  star_expires_at   timestamptz,
  images            jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id                              AS listing_id,
    l.title                           AS listing_title,
    l.rate                            AS listing_rate,
    l.service_type,
    l.duration_minutes,
    p.id                              AS provider_id,
    p.username                        AS provider_username,
    p.avatar_url                      AS provider_avatar,
    p.verification_status::text       AS provider_verified,
    p.city                            AS provider_city,
    p.age                             AS provider_age,
    p.last_seen_at                    AS provider_last_seen_at,
    ls.expires_at                     AS star_expires_at,
    COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object('url', li.url, 'sort_order', li.sort_order)
        ORDER BY li.sort_order
      ) FROM listing_images li WHERE li.listing_id = l.id),
      '[]'::jsonb
    ) AS images
  FROM listing_stars ls
  JOIN listings l  ON l.id  = ls.listing_id
  JOIN profiles p  ON p.id  = ls.provider_id
  WHERE ls.is_active = true
    AND ls.expires_at > now()
    AND l.is_active = true
    AND l.expires_at > now()
    AND p.is_posting_suspended = false
    AND (p_city IS NULL OR p.city ILIKE p_city)
  ORDER BY md5(ls.id::text || p_seed::text)
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_bumped_listings(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_explore_listings(text, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_starred_listings(text, integer, integer) TO anon, authenticated;
