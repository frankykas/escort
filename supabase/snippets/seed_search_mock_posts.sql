-- ============================================================================
-- Seed: mock posts + searchable bios for testing the search modal
-- ============================================================================
-- The search RPC `search_posts_by_profile()` matches PROFILES (username + bio),
-- then returns the matched profiles' posts. So to make searches return rows,
-- the keywords must live in profile bios — not just in post captions.
--
-- This seed does two things:
--   1. Tags ~10 existing providers' bios with a curated set of search keywords
--      (saved as a JSON-friendly suffix so we can detect + clean later)
--   2. Inserts ~30 mock posts (status_updates) under those tagged providers,
--      each with a varied caption + image so the grid has content to show
--
-- After running, try these in the search modal:
--
--   blonde, brunette, redhead          → hair colors
--   montreal, toronto, vancouver       → cities
--   brunch, gym, yoga, beach, paris    → lifestyle / travel
--   selfie, photoshoot, lingerie       → content type
--   gfe, dinner, vip                   → service flavor
--
-- Safe to re-run: the cleanup block at the top removes prior seeded posts and
-- strips the bio tag before reapplying.
-- ============================================================================

BEGIN;


-- ── 1. Cleanup previous seed run ───────────────────────────────────────────

DELETE FROM status_updates
WHERE caption ~* '\[seed:search\]';

UPDATE status_updates
SET caption = trim(regexp_replace(caption, '\s*\[seed:search\]\s*', ' ', 'gi'))
WHERE caption ~* '\[seed:search\]';

UPDATE profiles
SET bio = trim(both E' \n' FROM regexp_replace(
        coalesce(bio, ''),
        E'\\s*\\[seed:search\\][\\s\\S]*$',
        '',
        'g'))
WHERE bio LIKE '%[seed:search]%';


-- ── 2. Tag a handful of providers' bios with searchable keywords ──────────
-- We pick 10 providers (deterministic by created_at order) and append a
-- keyword bundle to each. Searches against any of those keywords will then
-- match the provider and return their posts.

WITH providers AS (
  SELECT id, row_number() OVER (ORDER BY created_at) AS rn
  FROM profiles
  WHERE is_provider = true
    AND is_posting_suspended = false
  LIMIT 10
),
keyword_bundles(rn, bundle) AS (
  VALUES
    ( 1, 'blonde brunch montreal yoga selfie gfe'),
    ( 2, 'brunette montreal photoshoot lingerie dinner'),
    ( 3, 'redhead toronto gym beach vip'),
    ( 4, 'blonde paris date selfie photoshoot'),
    ( 5, 'brunette vancouver yoga brunch lingerie'),
    ( 6, 'redhead montreal gym dinner vip'),
    ( 7, 'blonde toronto beach paris brunch'),
    ( 8, 'brunette toronto selfie gym gfe'),
    ( 9, 'redhead vancouver yoga photoshoot dinner'),
    (10, 'blonde montreal lingerie paris vip')
)
UPDATE profiles p
SET bio = trim(both E' \n' FROM coalesce(p.bio, '')) ||
          E'\n\n[seed:search] ' || k.bundle
FROM providers pr
JOIN keyword_bundles k ON k.rn = pr.rn
WHERE p.id = pr.id;


-- ── 3. Insert mock posts for the tagged providers ─────────────────────────

WITH tagged AS (
  SELECT
    id,
    coalesce(city, 'Montreal') AS city,
    row_number() OVER (ORDER BY username) AS rn,
    count(*) OVER () AS total
  FROM profiles
  WHERE bio LIKE '%[seed:search]%'
),
images(idx, url) AS (
  VALUES
    ( 1, 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80'),
    ( 2, 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80'),
    ( 3, 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80'),
    ( 4, 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80'),
    ( 5, 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80'),
    ( 6, 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800&q=80'),
    ( 7, 'https://images.unsplash.com/photo-1521252659862-eec69941b071?w=800&q=80'),
    ( 8, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80'),
    ( 9, 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&q=80'),
    (10, 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80'),
    (11, 'https://images.unsplash.com/photo-1504593811423-6dd665756598?w=800&q=80'),
    (12, 'https://images.unsplash.com/photo-1524275804614-bf9933fbd56b?w=800&q=80'),
    (13, 'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=800&q=80'),
    (14, 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&q=80'),
    (15, 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80')
),
captions(idx, caption) AS (
  VALUES
    ( 1, 'Sunday brunch vibes, who''s joining?'),
    ( 2, 'Montreal nights, my favorite city'),
    ( 3, 'Toronto skyline from the rooftop tonight'),
    ( 4, 'Vancouver views, west coast best coast'),
    ( 5, 'Post-gym glow, leg day done'),
    ( 6, 'Morning yoga flow on the balcony'),
    ( 7, 'Beach day, sun and saltwater hair'),
    ( 8, 'Paris in spring is everything'),
    ( 9, 'Date night ready, who''s taking me out?'),
    (10, 'Lazy selfie before the makeup comes off'),
    (11, 'Behind the scenes of today''s photoshoot'),
    (12, 'New lingerie set arrived today'),
    (13, 'Going blonde for summer, opinions?'),
    (14, 'Brunette era is back, darker than ever'),
    (15, 'Redhead mood today, embracing the fire'),
    (16, 'Quick brunch and coffee then back to work'),
    (17, 'Late-night Montreal walk through the Plateau'),
    (18, 'Toronto rooftop pool weather finally'),
    (19, 'Vancouver rain, candles, and a book'),
    (20, 'Gym selfie, post-workout endorphins hitting'),
    (21, 'Hot yoga today, sweat is the new glow'),
    (22, 'Beach getaway booked for next month'),
    (23, 'Paris flashbacks, take me back already'),
    (24, 'Date with myself: wine, bath, candles'),
    (25, 'Mirror selfie before bed'),
    (26, 'Photoshoot drop, full set this week'),
    (27, 'New lingerie haul try-on later tonight'),
    (28, 'Going darker, brunette suits the season'),
    (29, 'Redhead curls behaving today, finally'),
    (30, 'New post fresh off the camera')
)
INSERT INTO status_updates (
  id, provider_id, caption, media_url, media_type, post_type,
  likes_count, comments_count, views_count, created_at, expires_at
)
SELECT
  gen_random_uuid(),
  t.id,
  c.caption,
  (SELECT url FROM images WHERE idx = ((c.idx + t.rn) % 15) + 1),
  'image',
  'post',
  -- Spread engagement so freshness vs popularity weighting is observable.
  (50 + (c.idx * 13) % 800)::int,                 -- likes_count
  (2  + (c.idx * 7)  % 60)::int,                  -- comments_count
  (200 + (c.idx * 41) % 4000)::int,               -- views_count
  -- Spread timestamps across the last 25 days.
  now() - ((c.idx * 19 % 25) || ' days')::interval
       - ((c.idx * 7  % 23) || ' hours')::interval,
  now() + interval '365 days'
FROM captions c
JOIN tagged t ON t.rn = ((c.idx - 1) % t.total) + 1;


-- ── 4. Sanity check ────────────────────────────────────────────────────────

DO $$
DECLARE
  bios   int;
  posts  int;
BEGIN
  SELECT count(*) INTO bios  FROM profiles       WHERE bio     LIKE '%[seed:search]%';
  SELECT count(*) INTO posts FROM status_updates su
  JOIN profiles p ON p.id = su.provider_id
  WHERE p.bio LIKE '%[seed:search]%';
  RAISE NOTICE 'Tagged % providers, inserted % mock posts.', bios, posts;
END $$;

COMMIT;


-- ── Try it ─────────────────────────────────────────────────────────────────
-- After commit, confirm the search RPC returns rows for any keyword:
--
--   SELECT provider_username, left(caption, 50) AS caption, match_rank
--   FROM search_posts_by_profile('blonde', 30, 0);
--
--   SELECT provider_username, left(caption, 50) AS caption, match_rank
--   FROM search_posts_by_profile('montreal', 30, 0);
--
--   SELECT provider_username, left(caption, 50) AS caption, match_rank
--   FROM search_posts_by_profile('yoga', 30, 0);
--
-- All keywords from the bundles in step 2 should produce results.
