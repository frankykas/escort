-- =============================================================================
-- Cleopatra — Migration 004: Comments + profile-page RLS fix
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Comments table (with threading support via parent_comment_id)
-- ---------------------------------------------------------------------------

CREATE TABLE comments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  status_update_id  uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_comment_id uuid        REFERENCES comments(id) ON DELETE CASCADE,
  body              text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments: public read"
  ON comments FOR SELECT USING (true);

CREATE POLICY "comments: authenticated insert"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments: owner delete"
  ON comments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast per-post comment fetching (ordered by time)
CREATE INDEX comments_status_update_id_idx ON comments (status_update_id, created_at);

-- ---------------------------------------------------------------------------
-- 2. Auto-increment / decrement comments_count on status_updates
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE status_updates SET comments_count = comments_count + 1 WHERE id = NEW.status_update_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION decrement_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE status_updates SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.status_update_id;
  RETURN OLD;
END; $$;

CREATE TRIGGER on_comment_insert
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION increment_comments_count();

CREATE TRIGGER on_comment_delete
  AFTER DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION decrement_comments_count();

-- ---------------------------------------------------------------------------
-- 3. Allow reading all status_updates (not just unexpired)
--    The existing "public read unexpired" policy limits profile grids to 24h.
--    This additional policy lets profile pages show all historical posts.
--    The feed still filters expires_at in its own WHERE clause.
-- ---------------------------------------------------------------------------

CREATE POLICY "status_updates: public read all"
  ON status_updates FOR SELECT
  USING (true);

-- ---------------------------------------------------------------------------
-- 4. Allow reading all profiles (not just verified)
--    The existing policy limits reads to verified profiles or own profile,
--    which breaks profile pages for non-verified users.
-- ---------------------------------------------------------------------------

CREATE POLICY "profiles: public read all"
  ON profiles FOR SELECT
  USING (true);
