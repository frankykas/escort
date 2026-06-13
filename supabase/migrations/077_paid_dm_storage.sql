-- =============================================================================
-- Cleopatra — Migration 077: Paid DM private storage (M3c)
-- Locked DM media lives in the private premium-content bucket, served only via
-- a signed URL after the recipient pays. attachment_path holds that private key
-- (distinct from the public attachment_url used by normal messages).
--
-- is_locked / unlock_price already exist from 073; content_unlocks already
-- accepts content_type='message' from 073.
-- =============================================================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachment_path text;
