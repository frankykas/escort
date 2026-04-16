-- ============================================================================
-- Migration 052: RLS hardening — close direct-from-browser exploit paths
-- ============================================================================
-- Findings closed:
--   1. posting_package_purchases self-insert (credit self-grant)
--   2. bump_listing trusted caller-supplied p_provider_id
--   3. create_listing_with_credit trusted caller-supplied p_provider_id
--   4. mark_channel_read / get_unread_count / get_conversations
--      trusted caller-supplied p_user_id
--   5. get_pending_comments / count_pending_comments trusted caller-supplied
--      p_provider_id
--   6. message_requests mr_recipient_update missing WITH CHECK
--   7. status-updates and chat-attachments storage INSERT policies didn't
--      enforce folder-prefix ownership
--
-- Strategy for SECURITY DEFINER RPCs that take a caller-id parameter:
--   We keep the parameter (so service-role callers from API routes don't
--   need code changes) but add a guard that requires the parameter to
--   match auth.uid() unless the caller is service_role.
--
-- This is intentionally a *defense* layer. The API layer is already
-- authenticated; this prevents the direct-from-browser bypass where an
-- attacker calls supabase.rpc(...) with someone else's UUID.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. posting_package_purchases — kill the self-grant vector               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- The original policy let any authenticated user INSERT a row claiming any
-- credits_purchased / credits_remaining value. The Stripe webhook is the only
-- legitimate writer and runs with service_role, which bypasses RLS — so we
-- simply drop the user-facing INSERT policy.

DROP POLICY IF EXISTS "posting_package_purchases: owner insert"
  ON posting_package_purchases;

-- (No replacement needed — service_role bypasses RLS by default.)


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. bump_listing — bind p_provider_id to the actual caller               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION bump_listing(
  p_provider_id    uuid,
  p_listing_id     uuid,
  p_tier           integer DEFAULT 1,
  p_duration_hours integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id      uuid;
  v_credits_cost  integer;
  v_credit_ok     boolean;
  v_bump_id       uuid;
  v_listing_title text;
  v_expires_at    timestamptz;
  v_i             integer;
BEGIN
  -- Caller-identity guard (the whole reason this migration exists).
  -- Service-role callers (API routes) bypass; everyone else must be acting
  -- as themselves.
  IF auth.role() <> 'service_role' AND auth.uid() <> p_provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_tier NOT IN (1, 2, 3) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier. Must be 1, 2, or 3');
  END IF;

  v_credits_cost := p_tier;

  SELECT provider_id, title INTO v_owner_id, v_listing_title
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

  IF EXISTS (
    SELECT 1 FROM listing_bumps
    WHERE listing_id = p_listing_id
      AND is_active = true
      AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Listing already has an active bump');
  END IF;

  FOR v_i IN 1..v_credits_cost LOOP
    SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
    IF NOT v_credit_ok THEN
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
      RETURN jsonb_build_object('success', false, 'error',
        format('Insufficient credits. Tier %s requires %s credits', p_tier, v_credits_cost));
    END IF;
  END LOOP;

  v_expires_at := now() + (p_duration_hours || ' hours')::interval;

  INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, expires_at)
  VALUES (p_listing_id, p_provider_id, p_tier, v_credits_cost, v_expires_at)
  RETURNING id INTO v_bump_id;

  INSERT INTO status_updates (
    provider_id, post_type, media_type, caption,
    media_url, expires_at, country_code
  )
  SELECT
    p_provider_id,
    'story',
    'image',
    v_listing_title,
    p.avatar_url,
    v_expires_at,
    p.country_code
  FROM profiles p
  WHERE p.id = p_provider_id;

  RETURN jsonb_build_object(
    'success', true,
    'bump_id', v_bump_id,
    'tier', p_tier,
    'credits_spent', v_credits_cost,
    'expires_at', v_expires_at
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. create_listing_with_credit — bind p_provider_id to actual caller     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION create_listing_with_credit(
  p_provider_id      uuid,
  p_title            text,
  p_description      text DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_rate             integer DEFAULT NULL,
  p_service_type     text DEFAULT NULL,
  p_perks            text[] DEFAULT '{}',
  p_duration_hours   integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing_id    uuid;
  v_credit_ok     boolean;
  v_listing_count integer;
  v_is_first      boolean;
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_provider_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_provider_id AND is_posting_suspended = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Posting suspended');
  END IF;

  SELECT COUNT(*) INTO v_listing_count
  FROM listings
  WHERE provider_id = p_provider_id;

  v_is_first := (v_listing_count = 0);

  IF NOT v_is_first THEN
    SELECT deduct_post_credit(p_provider_id) INTO v_credit_ok;
    IF NOT v_credit_ok THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
    END IF;
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
    'success', true,
    'listing_id', v_listing_id,
    'is_first_free', v_is_first
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. Chat RPCs — bind p_user_id to actual caller                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS get_unread_count(uuid);
CREATE OR REPLACE FUNCTION get_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT coalesce(count(*), 0)
    FROM chat_messages m
    JOIN chat_channel_members cm
      ON cm.channel_id = m.channel_id
     AND cm.user_id = p_user_id
    WHERE m.created_at > cm.last_read_at
      AND m.sender_id <> p_user_id
  );
END;
$$;


DROP FUNCTION IF EXISTS mark_channel_read(text, uuid);
CREATE OR REPLACE FUNCTION mark_channel_read(p_channel_id text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE chat_channel_members
  SET last_read_at = now()
  WHERE channel_id = p_channel_id
    AND user_id = p_user_id;
END;
$$;


DROP FUNCTION IF EXISTS get_conversations(uuid);
CREATE OR REPLACE FUNCTION get_conversations(p_user_id uuid)
RETURNS TABLE (
  channel_id      text,
  partner_id      uuid,
  partner_name    text,
  partner_image   text,
  last_message    text,
  last_message_at timestamptz,
  last_sender_id  uuid,
  unread_count    bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_user_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    cm.channel_id,
    partner.id              AS partner_id,
    partner.username        AS partner_name,
    partner.avatar_url      AS partner_image,
    COALESCE(lm.text, CASE WHEN lm.attachment_type = 'image' THEN '[Image]' ELSE '[File]' END, '')
                            AS last_message,
    lm.created_at           AS last_message_at,
    lm.sender_id            AS last_sender_id,
    (
      SELECT count(*)
      FROM chat_messages um
      WHERE um.channel_id = cm.channel_id
        AND um.created_at > cm.last_read_at
        AND um.sender_id <> p_user_id
    )                       AS unread_count
  FROM chat_channel_members cm
  JOIN chat_channel_members pm
    ON pm.channel_id = cm.channel_id
   AND pm.user_id <> p_user_id
  JOIN profiles partner
    ON partner.id = pm.user_id
  LEFT JOIN LATERAL (
    SELECT text, created_at, sender_id, attachment_type
    FROM chat_messages
    WHERE channel_id = cm.channel_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE cm.user_id = p_user_id
  ORDER BY lm.created_at DESC NULLS LAST;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. Comment moderation RPCs — bind p_provider_id to actual caller        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DROP FUNCTION IF EXISTS get_pending_comments(uuid, integer, integer);
CREATE OR REPLACE FUNCTION get_pending_comments(
  p_provider_id uuid,
  p_limit       integer DEFAULT 50,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE (
  comment_id         uuid,
  comment_body       text,
  comment_created    timestamptz,
  commenter_id       uuid,
  commenter_username text,
  commenter_avatar   text,
  post_id            uuid,
  post_caption       text,
  post_media_url     text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_provider_id THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    c.id            AS comment_id,
    c.body          AS comment_body,
    c.created_at    AS comment_created,
    c.user_id       AS commenter_id,
    cp.username     AS commenter_username,
    cp.avatar_url   AS commenter_avatar,
    su.id           AS post_id,
    su.caption      AS post_caption,
    su.media_url    AS post_media_url
  FROM comments c
  JOIN profiles cp ON cp.id = c.user_id
  JOIN status_updates su ON su.id = c.status_update_id
  WHERE su.provider_id = p_provider_id
    AND c.is_approved = false
    AND c.is_rejected = false
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


DROP FUNCTION IF EXISTS count_pending_comments(uuid);
CREATE OR REPLACE FUNCTION count_pending_comments(p_provider_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() <> p_provider_id THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT count(*)::integer
    FROM comments c
    JOIN status_updates su ON su.id = c.status_update_id
    WHERE su.provider_id = p_provider_id
      AND c.is_approved = false
      AND c.is_rejected = false
  );
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. message_requests — add WITH CHECK to recipient update                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Without WITH CHECK, the recipient could mutate the row to point at a
-- different sender / recipient / channel after the fact.

DROP POLICY IF EXISTS "mr_recipient_update" ON message_requests;

CREATE POLICY "mr_recipient_update"
  ON message_requests FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. Storage INSERT policies — enforce folder-prefix ownership            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Both buckets had INSERT policies that only checked auth.role() = 'authenticated',
-- letting any logged-in user upload files into another user's folder namespace.
-- The matching UPDATE/DELETE policies already enforced the folder check, so
-- this brings INSERT in line.

DROP POLICY IF EXISTS "storage: status-updates authenticated upload" ON storage.objects;

CREATE POLICY "storage: status-updates owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'status-updates'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "storage: chat-attachments authenticated upload" ON storage.objects;

CREATE POLICY "storage: chat-attachments owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- ============================================================================
-- NOT INCLUDED IN THIS MIGRATION (intentionally deferred):
--
--   • profiles public-read leakage of contact_phone / contact_whatsapp /
--     contact_telegram / persona_inquiry_id / persona_status / notification_prefs
--     and push_* toggles. Fixing this requires either splitting these columns
--     into a profile_private table (with a per-row owner policy) or wrapping
--     reads in a SECURITY DEFINER view that masks columns for non-owners.
--     Both have wide blast radius across the frontend and need a separate
--     migration + frontend audit.
-- ============================================================================
