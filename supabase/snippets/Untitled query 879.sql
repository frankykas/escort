-- ============================================================================
-- Seed 3 mock Bumped listings for the Explore page BumpedBar
-- ============================================================================
-- Prerequisites: at least 3 active listings with different providers.
-- This script picks the first 3 active listings and creates a Tier 1, 2, 3
-- bump for each respectively, expiring 24 hours from now.
--
-- Run in Supabase SQL Editor.
-- ============================================================================

DO $$
DECLARE
  v_listing RECORD;
  v_tier    integer := 1;
BEGIN
  FOR v_listing IN
    SELECT l.id AS listing_id, l.provider_id
    FROM listings l
    JOIN profiles p ON p.id = l.provider_id
    WHERE l.is_active = true
      AND l.expires_at > now()
      AND p.is_posting_suspended = false
    ORDER BY l.created_at DESC
    LIMIT 3
  LOOP
    -- Skip if this listing already has an active bump
    IF NOT EXISTS (
      SELECT 1 FROM listing_bumps
      WHERE listing_id = v_listing.listing_id
        AND is_active = true
        AND expires_at > now()
    ) THEN
      INSERT INTO listing_bumps (
        listing_id,
        provider_id,
        tier,
        credits_spent,
        expires_at,
        is_active
      ) VALUES (
        v_listing.listing_id,
        v_listing.provider_id,
        v_tier,
        v_tier,                      -- credits_spent = tier (1, 2, or 3)
        now() + interval '24 hours',
        true
      );

      RAISE NOTICE 'Bumped listing % at tier %', v_listing.listing_id, v_tier;
    ELSE
      RAISE NOTICE 'Listing % already has an active bump, skipping', v_listing.listing_id;
    END IF;

    v_tier := v_tier + 1;
  END LOOP;
END $$;
