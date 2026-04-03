-- ============================================================================
-- 034: Backfill chat_channels + chat_channel_members from accepted requests
-- ============================================================================
-- Any message_requests accepted under the old GetStream system have a
-- channel_id but no rows in the new Supabase chat tables. This migration
-- creates the missing rows so those conversations work with the new system.
-- ============================================================================

-- 1. Create chat_channels for accepted requests that don't already exist
INSERT INTO chat_channels (id, created_by, created_at)
SELECT
  mr.channel_id,
  mr.recipient_id,        -- provider who accepted
  mr.updated_at            -- when they accepted
FROM message_requests mr
WHERE mr.status = 'accepted'
  AND mr.channel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM chat_channels cc WHERE cc.id = mr.channel_id
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Create chat_channel_members for both sender and recipient
INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at)
SELECT mr.channel_id, mr.sender_id, mr.updated_at, mr.updated_at
FROM message_requests mr
WHERE mr.status = 'accepted'
  AND mr.channel_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM chat_channels cc WHERE cc.id = mr.channel_id)
ON CONFLICT (channel_id, user_id) DO NOTHING;

INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at)
SELECT mr.channel_id, mr.recipient_id, mr.updated_at, mr.updated_at
FROM message_requests mr
WHERE mr.status = 'accepted'
  AND mr.channel_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM chat_channels cc WHERE cc.id = mr.channel_id)
ON CONFLICT (channel_id, user_id) DO NOTHING;

-- 3. If there was an intro_message, insert it as the first chat_message
INSERT INTO chat_messages (channel_id, sender_id, text, created_at)
SELECT mr.channel_id, mr.sender_id, mr.intro_message, mr.created_at
FROM message_requests mr
WHERE mr.status = 'accepted'
  AND mr.channel_id IS NOT NULL
  AND mr.intro_message IS NOT NULL
  AND char_length(mr.intro_message) > 0
  AND EXISTS (SELECT 1 FROM chat_channels cc WHERE cc.id = mr.channel_id)
  AND NOT EXISTS (
    SELECT 1 FROM chat_messages cm
    WHERE cm.channel_id = mr.channel_id
  );
