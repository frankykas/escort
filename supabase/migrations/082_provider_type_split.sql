-- 082: Split provider boolean into provider_type enum
-- Introduces 'creator' (OF-style content only) and 'escort' (listings + content)

-- 1. Add provider_type column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS provider_type text
  CHECK (provider_type IN ('creator', 'escort'));

-- 2. Backfill: all existing providers become escorts (superset)
UPDATE profiles
SET provider_type = 'escort'
WHERE is_provider = true AND provider_type IS NULL;

-- 3. Keep is_provider in sync via trigger (backward compat)
CREATE OR REPLACE FUNCTION sync_is_provider_from_type()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_provider := (NEW.provider_type IS NOT NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_provider ON profiles;
CREATE TRIGGER trg_sync_is_provider
  BEFORE INSERT OR UPDATE OF provider_type ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_is_provider_from_type();

-- 4. Index for fast lookups by provider type
CREATE INDEX IF NOT EXISTS idx_profiles_provider_type
  ON profiles (provider_type)
  WHERE provider_type IS NOT NULL;
