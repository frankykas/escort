-- =============================================================================
-- Cleopatra — Migration 024: Last Active Status
-- Adds last_seen_at to profiles to track user activity.
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();

-- Create an index for performance if we ever want to query "online now" users
CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx ON profiles (last_seen_at DESC);
