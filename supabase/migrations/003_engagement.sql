-- =============================================================================
-- Cleopatra — Engagement Migration 003
-- Adds: likes, follows, denormalized engagement counts, auto-increment triggers
-- Run in Supabase SQL Editor after 002_storage.sql.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. likes
-- ---------------------------------------------------------------------------

CREATE TABLE likes (
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status_update_id  uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, status_update_id)
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes: public read"
  ON likes FOR SELECT USING (true);

CREATE POLICY "likes: authenticated insert"
  ON likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "likes: owner delete"
  ON likes FOR DELETE
  USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 2. follows
-- ---------------------------------------------------------------------------

CREATE TABLE follows (
  follower_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows: public read"
  ON follows FOR SELECT USING (true);

CREATE POLICY "follows: authenticated insert"
  ON follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows: owner delete"
  ON follows FOR DELETE
  USING (auth.uid() = follower_id);


-- ---------------------------------------------------------------------------
-- 3. Denormalized engagement columns on status_updates
-- ---------------------------------------------------------------------------

ALTER TABLE status_updates
  ADD COLUMN likes_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN comments_count integer NOT NULL DEFAULT 0,
  ADD COLUMN views_count    integer NOT NULL DEFAULT 0;


-- ---------------------------------------------------------------------------
-- 4. Trigger: auto-increment likes_count on INSERT into likes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION increment_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE status_updates
  SET likes_count = likes_count + 1
  WHERE id = NEW.status_update_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION increment_likes_count();


-- ---------------------------------------------------------------------------
-- 5. Trigger: auto-decrement likes_count on DELETE from likes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION decrement_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE status_updates
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = OLD.status_update_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_like_delete
  AFTER DELETE ON likes
  FOR EACH ROW
  EXECUTE FUNCTION decrement_likes_count();
