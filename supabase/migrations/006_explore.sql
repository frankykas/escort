-- =============================================================================
-- Cleopatra — Migration 006: Explore / provider discovery
-- =============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS city                text,
  ADD COLUMN IF NOT EXISTS country_code        char(2),
  ADD COLUMN IF NOT EXISTS lat                 float8,
  ADD COLUMN IF NOT EXISTS lng                 float8,
  ADD COLUMN IF NOT EXISTS incall              boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS outcall             boolean     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS age                 smallint,
  ADD COLUMN IF NOT EXISTS hourly_rate         integer,      -- stored in pence/cents
  ADD COLUMN IF NOT EXISTS available_until     timestamptz,  -- provider sets their own window
  ADD COLUMN IF NOT EXISTS service_categories  text[]      NOT NULL DEFAULT '{}';

-- Fast explore queries: city + verification + provider flag
CREATE INDEX IF NOT EXISTS profiles_explore_idx
  ON profiles (city, verification_status, is_provider)
  WHERE is_provider = true;

-- Fast "available now" filter
CREATE INDEX IF NOT EXISTS profiles_available_idx
  ON profiles (available_until)
  WHERE available_until IS NOT NULL;

-- Fast geo bounding-box queries (PostGIS-free, good enough for v1)
CREATE INDEX IF NOT EXISTS profiles_geo_idx
  ON profiles (lat, lng)
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
