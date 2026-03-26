-- =============================================================================
-- Cleopatra — Migration 005: Feature flags, content tiers, profile scalability
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. Runtime feature flags (admin-toggleable, no redeploy needed)
-- ---------------------------------------------------------------------------

CREATE TABLE feature_flags (
  key         text        PRIMARY KEY,
  enabled     boolean     NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Only super admins can read/write feature flags
-- For now, service role only (no public access)
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags: service role only"
  ON feature_flags
  USING (false); -- blocked for all anon/authenticated; service role bypasses RLS

-- Seed default flags
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('reviews_enabled',              false, 'Allow clients to rate and review escorts'),
  ('age_verification_required',    false, 'Require ID verification to access premium content'),
  ('premium_content_enabled',      false, 'Enable premium/VIP content tiers on posts'),
  ('private_profiles_enabled',     true,  'Allow users to make their profile private'),
  ('bundle_subscriptions_enabled', false, 'Enable bundle subscription packages'),
  ('direct_messages_enabled',      false, 'Enable direct messaging between users');


-- ---------------------------------------------------------------------------
-- 2. Content tiers on status_updates
--    free     → visible to everyone
--    premium  → requires individual subscription OR a bundle slot
--    vip      → requires individual subscription only (no bundle coverage)
-- ---------------------------------------------------------------------------

ALTER TABLE status_updates
  ADD COLUMN content_tier text NOT NULL DEFAULT 'free'
    CHECK (content_tier IN ('free', 'premium', 'vip'));


-- ---------------------------------------------------------------------------
-- 3. Profile scalability — denormalized follower/following counts
--    Avoids COUNT() queries on the profiles page at scale
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN is_private        boolean NOT NULL DEFAULT false,
  ADD COLUMN followers_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN following_count   integer NOT NULL DEFAULT 0;

-- Backfill from existing follows data
UPDATE profiles p
  SET followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = p.id),
      following_count = (SELECT COUNT(*) FROM follows WHERE follower_id  = p.id);

-- Trigger functions (SECURITY DEFINER to bypass RLS on profiles)
CREATE OR REPLACE FUNCTION on_follow_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION on_follow_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  RETURN OLD;
END; $$;

CREATE TRIGGER trg_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_insert();

CREATE TRIGGER trg_follow_delete
  AFTER DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION on_follow_delete();
