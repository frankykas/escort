-- ============================================================================
-- 033: Rename stream_channel_id → channel_id in message_requests
-- ============================================================================
-- Removes the Stream-specific naming. The column value (64-char concatenated
-- UUIDs) stays the same — it's now a FK to chat_channels.id.
-- ============================================================================

ALTER TABLE message_requests
  RENAME COLUMN stream_channel_id TO channel_id;
