-- ============================================================================
-- 032: Chat channels & messages (replaces GetStream for message persistence)
-- ============================================================================
-- LiveKit handles real-time transport only. These tables own persistence,
-- membership, and unread tracking — all queryable via Supabase.
-- ============================================================================

-- ── chat_channels ───────────────────────────────────────────────────────────
-- One row per accepted conversation. ID matches the channelId() helper
-- (two UUIDs without hyphens, sorted and concatenated — exactly 64 chars).

CREATE TABLE chat_channels (
  id          text        PRIMARY KEY CHECK (char_length(id) <= 64),
  created_by  uuid        NOT NULL REFERENCES profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;

-- ── chat_channel_members ────────────────────────────────────────────────────
-- Two rows per channel (1:1 messaging). last_read_at drives unread counts.

CREATE TABLE chat_channel_members (
  channel_id   text        NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES profiles(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX idx_chat_members_user ON chat_channel_members (user_id);

ALTER TABLE chat_channel_members ENABLE ROW LEVEL SECURITY;

-- ── chat_messages ───────────────────────────────────────────────────────────
-- Canonical message store. RTCDataChannel delivers in real time; this table
-- is the durable record written immediately after send.

CREATE TABLE chat_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  text        NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id   uuid        NOT NULL REFERENCES profiles(id),
  text        text        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_channel ON chat_messages (channel_id, created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ────────────────────────────────────────────────────────────

-- Channels: members can read their own channels
CREATE POLICY "chat_channels: member read"
  ON chat_channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_channel_members
      WHERE chat_channel_members.channel_id = chat_channels.id
        AND chat_channel_members.user_id = auth.uid()
    )
  );

-- Channel members: can see memberships of channels they belong to
CREATE POLICY "chat_channel_members: member read"
  ON chat_channel_members FOR SELECT
  USING (
    channel_id IN (
      SELECT cm.channel_id FROM chat_channel_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- Messages: members can read messages in their channels
CREATE POLICY "chat_messages: member read"
  ON chat_messages FOR SELECT
  USING (
    channel_id IN (
      SELECT cm.channel_id FROM chat_channel_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- Messages: members can send messages in their channels
CREATE POLICY "chat_messages: member insert"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND channel_id IN (
      SELECT cm.channel_id FROM chat_channel_members cm
      WHERE cm.user_id = auth.uid()
    )
  );

-- ── RPC: unread count ───────────────────────────────────────────────────────
-- Returns total unread messages across all channels for a user.
-- Called by the useUnreadCount hook (replaces Stream total_unread_count).

CREATE OR REPLACE FUNCTION get_unread_count(p_user_id uuid)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT coalesce(count(*), 0)
  FROM chat_messages m
  JOIN chat_channel_members cm
    ON cm.channel_id = m.channel_id
   AND cm.user_id = p_user_id
  WHERE m.created_at > cm.last_read_at
    AND m.sender_id <> p_user_id;
$$;

-- ── RPC: mark channel read ─────────────────────────────────────────────────
-- Updates last_read_at to now(). Called when a user opens a thread.

CREATE OR REPLACE FUNCTION mark_channel_read(p_channel_id text, p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  UPDATE chat_channel_members
  SET last_read_at = now()
  WHERE channel_id = p_channel_id
    AND user_id = p_user_id;
$$;

-- ── RPC: get conversations ─────────────────────────────────────────────────
-- Returns all conversations for a user with partner info, last message, and
-- unread count. Replaces Stream's queryChannels().

CREATE OR REPLACE FUNCTION get_conversations(p_user_id uuid)
RETURNS TABLE (
  channel_id     text,
  partner_id     uuid,
  partner_name   text,
  partner_image  text,
  last_message   text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count   bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    cm.channel_id,
    partner.id              AS partner_id,
    partner.username        AS partner_name,
    partner.avatar_url      AS partner_image,
    lm.text                 AS last_message,
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
  -- Join the OTHER member to get partner info
  JOIN chat_channel_members pm
    ON pm.channel_id = cm.channel_id
   AND pm.user_id <> p_user_id
  JOIN profiles partner
    ON partner.id = pm.user_id
  -- Latest message via lateral join
  LEFT JOIN LATERAL (
    SELECT text, created_at, sender_id
    FROM chat_messages
    WHERE channel_id = cm.channel_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  WHERE cm.user_id = p_user_id
  ORDER BY lm.created_at DESC NULLS LAST;
$$;
