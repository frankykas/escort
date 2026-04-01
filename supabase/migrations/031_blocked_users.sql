-- ============================================================================
-- Migration 031: Blocked users
-- ============================================================================
-- Providers can block profiles from messaging them. Blocked users cannot
-- send message requests to the blocker.
-- ============================================================================

CREATE TABLE IF NOT EXISTS blocked_users (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bu_no_self_block  CHECK (blocker_id <> blocked_id),
  CONSTRAINT bu_unique_pair    UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Users can see their own blocks
CREATE POLICY "bu_owner_read"
  ON blocked_users FOR SELECT
  USING (blocker_id = auth.uid());

-- Users can block others
CREATE POLICY "bu_owner_insert"
  ON blocked_users FOR INSERT
  WITH CHECK (blocker_id = auth.uid());

-- Users can unblock
CREATE POLICY "bu_owner_delete"
  ON blocked_users FOR DELETE
  USING (blocker_id = auth.uid());

CREATE INDEX IF NOT EXISTS bu_blocker_idx
  ON blocked_users (blocker_id, blocked_id);
