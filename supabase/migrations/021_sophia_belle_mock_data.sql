-- ============================================================================
-- Migration 021: Mock posts & story for sophia.belle
-- ============================================================================
-- Adds sample feed posts and an active story so the explore page has content.
-- Safe to re-run: uses ON CONFLICT / IF NOT EXISTS patterns.
-- ============================================================================

DO $$
DECLARE
  v_provider_id uuid;
BEGIN
  -- Find sophia.belle's profile
  SELECT id INTO v_provider_id
  FROM profiles
  WHERE username = 'sophia.belle';

  IF v_provider_id IS NULL THEN
    RAISE NOTICE 'sophia.belle not found — skipping mock data';
    RETURN;
  END IF;

  -- ── Feed posts (permanent, far-future expiry) ────────────────────────────

  INSERT INTO status_updates (provider_id, caption, media_url, media_type, post_type, country_code, expires_at)
  VALUES
    (
      v_provider_id,
      'New to the city and loving every moment. Available downtown this weekend — message me to connect.',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
      'image', 'post', 'CA',
      '2099-01-01T00:00:00Z'
    ),
    (
      v_provider_id,
      'Evening vibes. Nothing beats a candlelit dinner date. Who''s joining?',
      'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
      'image', 'post', 'CA',
      '2099-01-01T00:00:00Z'
    ),
    (
      v_provider_id,
      'Just wrapped a lovely spa day. Feeling refreshed and ready for new adventures.',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
      'image', 'post', 'CA',
      '2099-01-01T00:00:00Z'
    )
  ON CONFLICT DO NOTHING;

  -- ── Active story (expires 24h from now) ──────────────────────────────────

  INSERT INTO status_updates (provider_id, caption, media_url, media_type, post_type, country_code, expires_at)
  VALUES
    (
      v_provider_id,
      'Good morning! Available today in downtown Toronto.',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
      'image', 'story', 'CA',
      now() + interval '24 hours'
    );

END;
$$;
