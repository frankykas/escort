-- Seed active Bump + VIP/Star listings for Explore.
-- Intended for local/staging/demo use from the Supabase SQL editor.
--
-- What it does:
--   - Uses existing listings and providers.
--   - Refreshes a small set of demo listings so Explore can show them.
--   - Inserts active listing_bumps across tiers 1/2/3.
--   - Inserts active listing_stars (VIP featured listings).
--   - Does NOT deduct credits from providers.
--   - Avoids adding duplicate active placements for the same listing/provider.
--
-- If the final totals are still 0, your database has no listings yet.
-- Run one of the larger seed files first, such as:
--   supabase/snippets/seed_messages_mock.sql
-- or:
--   supabase/migrations/059_populate_full_app.sql

-- Cleanup for old/expired rows only.
UPDATE public.listing_bumps
SET is_active = false
WHERE is_active = true
  AND expires_at <= now();

UPDATE public.listing_stars
SET is_active = false
WHERE is_active = true
  AND expires_at <= now();

-- Demo normalization:
-- Make up to 12 existing listings eligible for Explore.
-- This fixes the common "script ran but total is 0" case where demo listings
-- are expired, inactive, attached to non-provider profiles, or missing city.
WITH demo_listings AS (
  SELECT
    l.id AS listing_id,
    l.provider_id,
    row_number() OVER (
      ORDER BY
        CASE WHEN p.verification_status::text = 'verified' THEN 0 ELSE 1 END,
        l.created_at DESC,
        l.id
    ) AS rn
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.provider_id
  ORDER BY
    CASE WHEN p.verification_status::text = 'verified' THEN 0 ELSE 1 END,
    l.created_at DESC,
    l.id
  LIMIT 12
),
refreshed_listings AS (
  UPDATE public.listings l
  SET
    is_active = true,
    expires_at = now() + interval '7 days'
  FROM demo_listings dl
  WHERE l.id = dl.listing_id
  RETURNING l.id, l.provider_id
)
UPDATE public.profiles p
SET
  is_provider = true,
  is_posting_suspended = false,
  city = COALESCE(NULLIF(trim(p.city), ''), 'Toronto'),
  country_code = COALESCE(p.country_code, 'CA')
FROM refreshed_listings rl
WHERE p.id = rl.provider_id;

-- Bump placements: tier 1/2/3 mix, 24 hours.
WITH candidates AS (
  SELECT
    l.id AS listing_id,
    l.provider_id,
    row_number() OVER (
      ORDER BY
        CASE WHEN p.verification_status::text = 'verified' THEN 0 ELSE 1 END,
        l.created_at DESC,
        l.id
    ) AS rn
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.provider_id
  WHERE l.is_active = true
    AND l.expires_at > now()
    AND COALESCE(p.is_posting_suspended, false) = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.listing_bumps lb
      WHERE lb.listing_id = l.id
        AND lb.is_active = true
        AND lb.expires_at > now()
    )
),
selected AS (
  SELECT
    listing_id,
    provider_id,
    CASE
      WHEN rn IN (1, 4, 7) THEN 3
      WHEN rn IN (2, 5, 8) THEN 2
      ELSE 1
    END AS tier,
    rn
  FROM candidates
  WHERE rn <= 9
)
INSERT INTO public.listing_bumps (
  listing_id,
  provider_id,
  tier,
  credits_spent,
  bumped_at,
  expires_at,
  is_active
)
SELECT
  listing_id,
  provider_id,
  tier,
  tier AS credits_spent,
  now() - ((rn - 1) * interval '7 minutes') AS bumped_at,
  now() + interval '24 hours' AS expires_at,
  true AS is_active
FROM selected;

-- VIP / Star placements: large featured carousel, 3 hours.
WITH candidates AS (
  SELECT
    l.id AS listing_id,
    l.provider_id,
    NULLIF(trim(p.city), '') AS city,
    row_number() OVER (
      PARTITION BY lower(NULLIF(trim(p.city), ''))
      ORDER BY
        CASE WHEN p.verification_status::text = 'verified' THEN 0 ELSE 1 END,
        l.created_at DESC,
        l.id
    ) AS city_rank
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.provider_id
  WHERE l.is_active = true
    AND l.expires_at > now()
    AND COALESCE(p.is_posting_suspended, false) = false
    AND NULLIF(trim(p.city), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.listing_stars ls
      WHERE ls.provider_id = l.provider_id
        AND lower(ls.city) = lower(p.city)
        AND ls.is_active = true
        AND ls.expires_at > now()
    )
),
selected AS (
  SELECT
    listing_id,
    provider_id,
    city,
    row_number() OVER (ORDER BY city_rank, city, listing_id) AS rn
  FROM candidates
  WHERE city_rank <= 6
  LIMIT 8
)
INSERT INTO public.listing_stars (
  listing_id,
  provider_id,
  city,
  credits_spent,
  starred_at,
  expires_at,
  is_active
)
SELECT
  listing_id,
  provider_id,
  city,
  3 AS credits_spent,
  now() - ((rn - 1) * interval '5 minutes') AS starred_at,
  now() + interval '3 hours' AS expires_at,
  true AS is_active
FROM selected
WHERE (
  SELECT count(*)
  FROM public.listing_stars ls
  WHERE lower(ls.city) = lower(selected.city)
    AND ls.is_active = true
    AND ls.expires_at > now()
) < 6;

-- Quick check + useful diagnostics.
SELECT
  'all_listings' AS bucket,
  count(*) AS total
FROM public.listings
UNION ALL
SELECT
  'explore_eligible_listings' AS bucket,
  count(*) AS total
FROM public.listings l
JOIN public.profiles p ON p.id = l.provider_id
WHERE l.is_active = true
  AND l.expires_at > now()
  AND COALESCE(p.is_posting_suspended, false) = false
UNION ALL
SELECT
  'active_bumps' AS bucket,
  count(*) AS total
FROM public.listing_bumps lb
JOIN public.listings l ON l.id = lb.listing_id
JOIN public.profiles p ON p.id = lb.provider_id
WHERE lb.is_active = true
  AND lb.expires_at > now()
  AND l.is_active = true
  AND l.expires_at > now()
  AND COALESCE(p.is_posting_suspended, false) = false
UNION ALL
SELECT
  'active_vip_stars' AS bucket,
  count(*) AS total
FROM public.listing_stars ls
JOIN public.listings l ON l.id = ls.listing_id
JOIN public.profiles p ON p.id = ls.provider_id
WHERE ls.is_active = true
  AND ls.expires_at > now()
  AND l.is_active = true
  AND l.expires_at > now()
  AND COALESCE(p.is_posting_suspended, false) = false;
