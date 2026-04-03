-- ============================================================================
-- 035: Chat attachments — storage bucket + schema changes
-- ============================================================================

-- ── Storage bucket ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "storage: chat-attachments public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "storage: chat-attachments authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "storage: chat-attachments owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "storage: chat-attachments owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'chat-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Schema changes ──────────────────────────────────────────────────────────

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_type text CHECK (attachment_type IN ('image', 'file'));

-- Relax text constraint: allow empty/null text when an attachment is present
ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_text_check;

-- Make text nullable
ALTER TABLE chat_messages ALTER COLUMN text DROP NOT NULL;

-- New constraint: must have text OR attachment (or both)
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_content_check
  CHECK (
    char_length(text) <= 2000
    AND (
      (text IS NOT NULL AND char_length(text) >= 1)
      OR attachment_url IS NOT NULL
    )
  );

-- ── Update get_conversations RPC to show [Image] for attachment-only messages

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
$$;
