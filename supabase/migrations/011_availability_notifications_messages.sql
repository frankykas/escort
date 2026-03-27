-- =============================================================================
-- Cleopatra — Migration 011: Availability, Notification Prefs, Messages
-- =============================================================================


-- ── Extend profiles: availability schedule ───────────────────────────────────
-- Stored as JSONB: { available_now: bool, schedule: { "Mon": ["morning","evening"], ... } }

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS availability      jsonb NOT NULL DEFAULT '{"available_now": false, "schedule": {}}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{
    "email_new_message":    true,
    "email_new_enquiry":    true,
    "email_new_subscriber": true,
    "email_new_follower":   false,
    "push_enabled":         false
  }'::jsonb;


-- ── messages ─────────────────────────────────────────────────────────────────
-- Simple direct-message model. A conversation = all rows between two user IDs.

CREATE TABLE IF NOT EXISTS messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body          text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  listing_id    uuid        REFERENCES listings(id) ON DELETE SET NULL,
  is_read       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_no_self_message CHECK (sender_id <> recipient_id)
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can read messages they sent or received
CREATE POLICY "messages: read own"
  ON messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can send messages
CREATE POLICY "messages: authenticated insert"
  ON messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Users can delete their own sent messages
CREATE POLICY "messages: sender delete"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- Index for fast conversation lookups
CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at
  );

-- Index for inbox: latest message per conversation for a user
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON messages (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx    ON messages (sender_id,    created_at DESC);
