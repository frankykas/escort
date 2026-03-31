-- ============================================================================
-- Migration 019: Listing expiry + credit-per-listing
-- ============================================================================
-- Listings are now temporary (24h default). Creating a listing costs 1 credit.
-- This turns listings into a consumable product: escorts post when they're
-- available *today*, the listing auto-expires, and they pay again next time.
-- ============================================================================

-- 1. Add expiry column to listings (skip if already exists)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill existing listings: set expiry to 48h from now so they don't
-- all vanish immediately. New listings will get 24h from creation.
UPDATE listings SET expires_at = now() + interval '48 hours' WHERE expires_at IS NULL;

-- Make it NOT NULL after backfill
ALTER TABLE listings ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE listings ALTER COLUMN expires_at SET DEFAULT now() + interval '24 hours';

-- Index for efficient "active + not expired" queries
CREATE INDEX listings_active_expires_idx
  ON listings (created_at DESC)
  WHERE is_active = true;

-- 2. Update the public read policy to exclude expired listings
DROP POLICY IF EXISTS "listings: public read active" ON listings;
CREATE POLICY "listings: public read active"
  ON listings FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Provider can always see their own listings (even expired) for management
CREATE POLICY "listings: owner read all"
  ON listings FOR SELECT
  USING (provider_id = auth.uid());

-- 3. Add a platform setting for default listing duration
INSERT INTO platform_settings (key, value)
VALUES ('listing_duration_hours', '24'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Update the default posting packages to be "Bump Credits"
-- These credits work for both feed posts and listing creation
UPDATE posting_packages
SET name = 'Single Bump',
    description = 'Try it out — 1 credit for a single listing or post',
    post_credits = 1,
    price = 299,
    sort_order = 0
WHERE sort_order = 1 AND name = 'Starter';

UPDATE posting_packages
SET name = 'Starter Pack',
    description = 'Perfect for getting started',
    post_credits = 5,
    price = 999,
    sort_order = 1
WHERE name = 'Starter' OR (sort_order = 1 AND post_credits = 10);

UPDATE posting_packages
SET name = 'Popular Pack',
    description = 'Our most popular option — great value',
    post_credits = 15,
    price = 2499,
    sort_order = 2
WHERE name = 'Popular' OR (sort_order = 2 AND post_credits = 30);

UPDATE posting_packages
SET name = 'Pro Pack',
    description = 'For busy providers — best savings',
    post_credits = 40,
    price = 4999,
    sort_order = 3
WHERE name = 'Pro' OR (sort_order = 3 AND post_credits = 75);

UPDATE posting_packages
SET name = 'VIP Pack',
    description = 'Maximum value — $1 per credit',
    post_credits = 100,
    price = 9999,
    sort_order = 4
WHERE name = 'Unlimited' OR (sort_order = 4 AND post_credits = 200);

-- Insert a single-credit package if none exists at sort_order 0
INSERT INTO posting_packages (name, description, post_credits, price, sort_order, is_active)
SELECT 'Single Bump', 'Try it out — 1 credit for a single listing or post', 1, 299, 0, true
WHERE NOT EXISTS (SELECT 1 FROM posting_packages WHERE sort_order = 0);

-- 5. Function to create a listing with credit deduction
CREATE OR REPLACE FUNCTION create_listing_with_credit(
  p_provider_id     uuid,
  p_title           text,
  p_description     text DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_rate            integer DEFAULT NULL,
  p_service_type    text DEFAULT NULL,
  p_perks           text[] DEFAULT '{}',
  p_duration_hours  integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id uuid;
  v_credit_ok boolean;
BEGIN
  -- Check if provider is suspended
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  -- Deduct credit
  SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
  IF NOT v_credit_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Create the listing
  INSERT INTO listings (
    provider_id, title, description, duration_minutes,
    rate, service_type, perks, expires_at
  ) VALUES (
    p_provider_id, p_title, p_description, p_duration_minutes,
    p_rate, p_service_type, p_perks,
    now() + (p_duration_hours || ' hours')::interval
  )
  RETURNING id INTO v_listing_id;

  RETURN jsonb_build_object(
    'success', true,
    'listing_id', v_listing_id
  );
END;
$$;
