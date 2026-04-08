-- ============================================================================
-- 037: Pinned chats + read receipts for conversations list
-- ============================================================================

-- ── Add pin columns to chat_channel_members ────────────────────────────────
ALTER TABLE chat_channel_members
  ADD COLUMN IF NOT EXISTS is_pinned  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at  timestamptz;

-- ── Update get_conversations to return pin + partner read state ────────────
DROP FUNCTION IF EXISTS get_conversations(uuid);
CREATE OR REPLACE FUNCTION get_conversations(p_user_id uuid)
RETURNS TABLE (
  channel_id        text,
  partner_id        uuid,
  partner_name      text,
  partner_image     text,
  last_message      text,
  last_message_at   timestamptz,
  last_sender_id    uuid,
  unread_count      bigint,
  is_pinned         boolean,
  partner_last_read timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
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
    )                       AS unread_count,
    cm.is_pinned,
    pm.last_read_at         AS partner_last_read
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
  ORDER BY cm.is_pinned DESC, cm.pinned_at ASC NULLS LAST, lm.created_at DESC NULLS LAST;
$$;

-- ── RPC: toggle pin ───────────────────────────────────────────────────────
-- Providers can pin up to 5 chats. Clients can pin up to 3.
CREATE OR REPLACE FUNCTION toggle_pin_chat(
  p_channel_id text,
  p_user_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_currently_pinned boolean;
  v_pin_count        integer;
  v_max_pins         integer;
  v_is_provider      boolean;
BEGIN
  -- Get current state
  SELECT is_pinned INTO v_currently_pinned
  FROM chat_channel_members
  WHERE channel_id = p_channel_id AND user_id = p_user_id;

  IF v_currently_pinned IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a member');
  END IF;

  -- Unpinning always works
  IF v_currently_pinned THEN
    UPDATE chat_channel_members
    SET is_pinned = false, pinned_at = NULL
    WHERE channel_id = p_channel_id AND user_id = p_user_id;

    RETURN jsonb_build_object('success', true, 'pinned', false);
  END IF;

  -- Pinning — check limit
  SELECT is_provider INTO v_is_provider FROM profiles WHERE id = p_user_id;
  v_max_pins := CASE WHEN v_is_provider THEN 5 ELSE 3 END;

  SELECT count(*) INTO v_pin_count
  FROM chat_channel_members
  WHERE user_id = p_user_id AND is_pinned = true;

  IF v_pin_count >= v_max_pins THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Maximum %s pinned chats reached', v_max_pins)
    );
  END IF;

  UPDATE chat_channel_members
  SET is_pinned = true, pinned_at = now()
  WHERE channel_id = p_channel_id AND user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'pinned', true);
END;
$$;
