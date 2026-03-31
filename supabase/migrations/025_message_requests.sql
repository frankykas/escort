-- =============================================================================
-- Cleopatra — Migration 025: Message Requests
-- Adds a message request system where clients request to chat with providers.
-- Providers accept or reject. On accept, a GetStream channel is created.
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_requests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro_message    text        CHECK (char_length(intro_message) BETWEEN 1 AND 500),
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'rejected')),
  stream_channel_id text,      -- populated when accepted
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT mr_no_self_request CHECK (sender_id <> recipient_id),
  CONSTRAINT mr_unique_pair     UNIQUE (sender_id, recipient_id)
);

ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

-- Sender can see their own requests
CREATE POLICY "mr_sender_read"
  ON message_requests FOR SELECT
  USING (sender_id = auth.uid());

-- Recipient can see requests sent to them
CREATE POLICY "mr_recipient_read"
  ON message_requests FOR SELECT
  USING (recipient_id = auth.uid());

-- Authenticated users can create requests
CREATE POLICY "mr_insert"
  ON message_requests FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Only recipient can update (accept/reject)
CREATE POLICY "mr_recipient_update"
  ON message_requests FOR UPDATE
  USING (recipient_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS mr_recipient_status_idx
  ON message_requests (recipient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS mr_sender_idx
  ON message_requests (sender_id, created_at DESC);
