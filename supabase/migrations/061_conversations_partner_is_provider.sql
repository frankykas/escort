-- ============================================================================
-- 061: Add partner_is_provider to get_conversations
-- ============================================================================
-- Lets the inbox show a gold "Provider" badge next to escort partners (e.g.
-- when an escort is messaging another escort), distinguishing them from clients.
-- ============================================================================

DROP FUNCTION IF EXISTS get_conversations(uuid);

CREATE OR REPLACE FUNCTION get_conversations(p_user_id uuid)
RETURNS TABLE (
  channel_id           text,
  partner_id           uuid,
  partner_name         text,
  partner_image        text,
  partner_is_provider  boolean,
  last_message         text,
  last_message_at      timestamptz,
  last_sender_id       uuid,
  unread_count         bigint,
  is_pinned            boolean,
  partner_last_read    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    cm.channel_id,
    partner.id              AS partner_id,
    partner.username        AS partner_name,
    partner.avatar_url      AS partner_image,
    partner.is_provider     AS partner_is_provider,
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
