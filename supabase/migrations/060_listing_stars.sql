-- ============================================================================
-- Migration 060: Star system — premium listing placement
-- ============================================================================
-- A provider pays 3 credits for 3 hours of featured visibility in their city.
-- Star listings appear in a dedicated "En vedette" carousel at the top of
-- the Explore page, rendered larger with a gold glow.
--
-- Fairness:
--   • Session-seeded shuffle so each client sees a different order
--   • Max 6 active star slots per city
--   • One active star per provider per city (no stacking)
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. LISTING STARS TABLE                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS listing_stars (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid        NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  provider_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  city          text        NOT NULL,
  credits_spent integer     NOT NULL DEFAULT 3 CHECK (credits_spent = 3),
  starred_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true
);

ALTER TABLE listing_stars ENABLE ROW LEVEL SECURITY;

-- Providers can read their own stars
CREATE POLICY "listing_stars: owner read"
  ON listing_stars FOR SELECT
  USING (provider_id = auth.uid());

-- Service role can manage (creation via RPC)
CREATE POLICY "listing_stars: service_role manage"
  ON listing_stars FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Public can read active stars (needed for Explore featured section)
CREATE POLICY "listing_stars: public read active"
  ON listing_stars FOR SELECT
  USING (is_active = true AND expires_at > now());

-- Indexes
CREATE INDEX listing_stars_city_active_idx
  ON listing_stars (city, expires_at DESC)
  WHERE is_active = true;

CREATE INDEX listing_stars_provider_idx
  ON listing_stars (provider_id, expires_at DESC)
  WHERE is_active = true;

CREATE INDEX listing_stars_listing_idx
  ON listing_stars (listing_id, expires_at DESC)
  WHERE is_active = true;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. star_listing RPC                                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION star_listing(
  p_provider_id uuid,
  p_listing_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id     uuid;
  v_city         text;
  v_active_count integer;
  v_credit_ok    boolean;
  v_star_id      uuid;
  v_expires_at   timestamptz;
  v_next_expiry  timestamptz;
  v_i            integer;
BEGIN
  -- Verify ownership
  SELECT provider_id INTO v_owner_id
  FROM listings WHERE id = p_listing_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;
  IF v_owner_id != p_provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your listing');
  END IF;

  -- Check suspension
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  -- Get provider city
  SELECT city INTO v_city FROM profiles WHERE id = p_provider_id;
  IF v_city IS NULL OR v_city = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'City not set on profile');
  END IF;

  -- No stacking: one active star per provider per city
  IF EXISTS (
    SELECT 1 FROM listing_stars
    WHERE provider_id = p_provider_id
      AND lower(city) = lower(v_city)
      AND is_active = true
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active star in this city');
  END IF;

  -- Slot cap: max 6 active stars per city
  SELECT COUNT(*) INTO v_active_count
  FROM listing_stars
  WHERE lower(city) = lower(v_city)
    AND is_active = true
    AND expires_at > now();

  IF v_active_count >= 6 THEN
    SELECT MIN(expires_at) INTO v_next_expiry
    FROM listing_stars
    WHERE lower(city) = lower(v_city)
      AND is_active = true
      AND expires_at > now();

    RETURN jsonb_build_object(
      'success', false,
      'error', 'All star slots are full in your city',
      'slots_full', true,
      'next_available', v_next_expiry
    );
  END IF;

  -- Deduct 3 credits (FIFO, same pattern as bump_listing)
  FOR v_i IN 1..3 LOOP
    SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
    IF NOT v_credit_ok THEN
      -- Refund any already-deducted credits
      IF v_i > 1 THEN
        UPDATE profiles
        SET post_credits_balance = post_credits_balance + (v_i - 1)
        WHERE id = p_provider_id;
        UPDATE posting_package_purchases
        SET credits_remaining = credits_remaining + (v_i - 1)
        WHERE id = (
          SELECT id FROM posting_package_purchases
          WHERE provider_id = p_provider_id
          ORDER BY purchased_at DESC
          LIMIT 1
        );
      END IF;
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits. Star requires 3 credits');
    END IF;
  END LOOP;

  v_expires_at := now() + interval '3 hours';

  INSERT INTO listing_stars (listing_id, provider_id, city, credits_spent, expires_at)
  VALUES (p_listing_id, p_provider_id, v_city, 3, v_expires_at)
  RETURNING id INTO v_star_id;

  RETURN jsonb_build_object(
    'success', true,
    'star_id', v_star_id,
    'credits_spent', 3,
    'expires_at', v_expires_at,
    'active_stars_in_city', v_active_count + 1
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. get_starred_listings RPC                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION get_starred_listings(
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


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. get_star_slots RPC                                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION get_star_slots(p_city text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active integer;
  v_next   timestamptz;
BEGIN
  SELECT COUNT(*) INTO v_active
  FROM listing_stars
  WHERE lower(city) = lower(p_city)
    AND is_active = true
    AND expires_at > now();

  IF v_active >= 6 THEN
    SELECT MIN(expires_at) INTO v_next
    FROM listing_stars
    WHERE lower(city) = lower(p_city)
      AND is_active = true
      AND expires_at > now();
  END IF;

  RETURN jsonb_build_object(
    'active_count', v_active,
    'max_slots', 6,
    'slots_available', GREATEST(0, 6 - v_active),
    'next_available', v_next
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. EXPIRY CLEANUP                                                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION cleanup_expired_stars()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE listing_stars
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now();
END;
$$;

-- Run cleanup immediately for any stale test data
SELECT cleanup_expired_stars();
