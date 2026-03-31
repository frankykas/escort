-- ============================================================================
-- Migration 028: Relist expired listing (costs 1 credit)
-- ============================================================================

CREATE OR REPLACE FUNCTION relist_listing(
  p_provider_id  uuid,
  p_listing_id   uuid,
  p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_ok boolean;
  v_owner_id  uuid;
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

  -- Relist: reset expiry and reactivate
  UPDATE listings
  SET expires_at = now() + (p_duration_hours || ' hours')::interval,
      is_active = true
  WHERE id = p_listing_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
