-- ============================================================================
-- Migration 064: Fix credit deduction + make ALL listings free (launch promo)
-- ============================================================================
-- Two related fixes:
--
--  1. `deduct_post_credit` previously only consulted `posting_package_purchases`.
--     Welcome credits (mig 056) and admin grants only update the denormalized
--     `profiles.post_credits_balance`, leaving providers with a non-zero
--     balance but no ledger row — so Bump/Star always failed with
--     "Insufficient credits" even on a fresh 100-credit account.
--
--     The new logic:
--       a) Try the FIFO purchase ledger first (preserves paid-credit accounting).
--       b) If no ledger row exists but `profiles.post_credits_balance > 0`,
--          decrement the balance directly and succeed.
--       c) Only return FALSE when both sources are empty.
--
--  2. `create_listing_with_credit` and `relist_listing` no longer charge
--     credits at all — switching from the "first listing free" model to
--     "all listings free (limited time)". Bump and Star still cost credits;
--     only listing creation and relisting are free.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. FIX deduct_post_credit                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION deduct_post_credit(p_provider_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase_id uuid;
  v_balance     integer;
BEGIN
  -- ── Path A: FIFO purchase ledger (paid credits) ──────────────────────────
  SELECT id INTO v_purchase_id
  FROM posting_package_purchases
  WHERE provider_id = p_provider_id
    AND credits_remaining > 0
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_purchase_id IS NOT NULL THEN
    UPDATE posting_package_purchases
    SET credits_remaining = credits_remaining - 1
    WHERE id = v_purchase_id;

    UPDATE profiles
    SET post_credits_balance = GREATEST(post_credits_balance - 1, 0)
    WHERE id = p_provider_id;

    RETURN TRUE;
  END IF;

  -- ── Path B: denormalized balance (welcome / admin-granted credits) ───────
  SELECT post_credits_balance INTO v_balance
  FROM profiles
  WHERE id = p_provider_id
  FOR UPDATE;

  IF v_balance IS NULL OR v_balance <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE profiles
  SET post_credits_balance = post_credits_balance - 1
  WHERE id = p_provider_id;

  RETURN TRUE;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. Make listing creation FREE during launch                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

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
BEGIN
  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

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
    'success',       true,
    'listing_id',    v_listing_id,
    'is_first_free', true     -- kept for client compatibility
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. Make relisting FREE during launch                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION relist_listing(
  p_provider_id    uuid,
  p_listing_id     uuid,
  p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT provider_id INTO v_owner_id
  FROM listings WHERE id = p_listing_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing not found');
  END IF;

  IF v_owner_id != p_provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your listing');
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  UPDATE listings
  SET expires_at = now() + (p_duration_hours || ' hours')::interval,
      is_active  = true
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
