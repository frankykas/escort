-- Mark demo/NPC providers as recently active so the Explore active badge is visible.
-- Intended for local/staging/demo use from the Supabase SQL editor.
--
-- The UI treats profiles.last_seen_at within the last 5 minutes as "Active now".
-- This script updates providers that already have active Explore listings or posts.

WITH active_listing_providers AS (
  SELECT DISTINCT l.provider_id
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.provider_id
  WHERE l.is_active = true
    AND l.expires_at > now()
    AND COALESCE(p.is_posting_suspended, false) = false
),
active_post_providers AS (
  SELECT DISTINCT su.provider_id
  FROM public.status_updates su
  JOIN public.profiles p ON p.id = su.provider_id
  WHERE su.post_type = 'post'
    AND (su.expires_at IS NULL OR su.expires_at > now())
    AND (su.scheduled_at IS NULL OR su.scheduled_at <= now())
    AND COALESCE(p.is_posting_suspended, false) = false
),
providers AS (
  SELECT
    provider_id,
    row_number() OVER (ORDER BY provider_id) AS rn
  FROM (
    SELECT provider_id FROM active_listing_providers
    UNION
    SELECT provider_id FROM active_post_providers
  ) q
  LIMIT 12
)
UPDATE public.profiles p
SET
  is_provider = true,
  is_posting_suspended = false,
  last_seen_at = now() - ((providers.rn - 1) * interval '20 seconds')
FROM providers
WHERE p.id = providers.provider_id;

-- Quick check: these should show as active now in the UI.
SELECT
  username,
  city,
  last_seen_at,
  round(extract(epoch FROM (now() - last_seen_at)) / 60, 2) AS minutes_ago
FROM public.profiles
WHERE last_seen_at >= now() - interval '5 minutes'
ORDER BY last_seen_at DESC
LIMIT 12;
