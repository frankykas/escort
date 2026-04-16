-- ============================================================================
-- Seed 3 mock Star listings for the Explore page StarredBar
-- ============================================================================
-- Picks the first 3 active listings (different providers) and creates
-- a Star entry for each, expiring 3 hours from now.
--
-- Run in Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
  v_listing RECORD;
  v_count   integer := 0;
BEGIN
  FOR v_listing IN
    SELECT l.id AS listing_id, l.provider_id, p.city
    FROM listings l
    JOIN profiles p ON p.id = l.provider_id
    WHERE l.is_active = true
      AND l.expires_at > now()
      AND p.is_posting_suspended = false
      AND p.city IS NOT NULL
      AND p.city != ''
    ORDER BY l.created_at DESC
  LOOP
    -- Skip if this provider already has an active star in their city
    IF EXISTS (
      SELECT 1 FROM listing_stars
      WHERE provider_id = v_listing.provider_id
        AND is_active = true
        AND expires_at > now()
    ) THEN
      RAISE NOTICE 'Provider % already has an active star, skipping', v_listing.provider_id;
      CONTINUE;
    END IF;

    INSERT INTO listing_stars (
      listing_id,
      provider_id,
      city,
      credits_spent,
      expires_at,
      is_active
    ) VALUES (
      v_listing.listing_id,
      v_listing.provider_id,
      v_listing.city,
      3,
      now() + interval '3 hours',
      true
    );

    v_count := v_count + 1;
    RAISE NOTICE 'Starred listing % (provider %, city %)', v_listing.listing_id, v_listing.provider_id, v_listing.city;

    EXIT WHEN v_count >= 3;
  END LOOP;

  RAISE NOTICE 'Created % star entries', v_count;
END $$;
