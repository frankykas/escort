-- Migration 023: Reports / flags system
-- Users can report profiles, listings, posts, or messages

CREATE TABLE IF NOT EXISTS reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- What is being reported
  target_type text NOT NULL CHECK (target_type IN ('profile', 'listing', 'post', 'message')),
  target_id   uuid NOT NULL,
  -- Reason category
  reason      text NOT NULL CHECK (reason IN (
    'spam', 'fake_profile', 'harassment', 'underage',
    'non_consensual', 'scam', 'inappropriate_content', 'other'
  )),
  details     text,  -- optional free-text
  -- Admin resolution
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at DESC);
-- Prevent duplicate reports from the same user on the same target
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_per_user
  ON reports(reporter_id, target_type, target_id);

-- RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports
CREATE POLICY "Users can create reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (auth.uid() = reporter_id);
