-- =============================================================================
-- Cleopatra — Migration 014: Add shares_count to status_updates
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add shares_count column to status_updates
-- ---------------------------------------------------------------------------

ALTER TABLE status_updates
  ADD COLUMN shares_count integer NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. Create shares table for tracking shares
-- ---------------------------------------------------------------------------

CREATE TABLE shares (
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status_update_id  uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, status_update_id)
);

ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shares: public read"
  ON shares FOR SELECT USING (true);

CREATE POLICY "shares: authenticated insert"
  ON shares FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shares: owner delete"
  ON shares FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. Trigger: auto-increment shares_count on INSERT into shares
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE status_updates
  SET shares_count = shares_count + 1
  WHERE id = NEW.status_update_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_share_insert
  AFTER INSERT ON shares
  FOR EACH ROW
  EXECUTE FUNCTION increment_shares_count();

-- ---------------------------------------------------------------------------
-- 4. Trigger: auto-decrement shares_count on DELETE from shares
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION decrement_shares_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE status_updates
  SET shares_count = GREATEST(shares_count - 1, 0)
  WHERE id = OLD.status_update_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_share_delete
  AFTER DELETE ON shares
  FOR EACH ROW
  EXECUTE FUNCTION decrement_shares_count();
