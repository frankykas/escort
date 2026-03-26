-- =============================================================================
-- Cleopatra — Migration 007: Listings + profile attributes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profile attribute columns
-- ---------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS height_cm    smallint,
  ADD COLUMN IF NOT EXISTS build        text,        -- 'slim' | 'athletic' | 'curvy' | 'plus-size'
  ADD COLUMN IF NOT EXISTS hair_color   text,
  ADD COLUMN IF NOT EXISTS eye_color    text,
  ADD COLUMN IF NOT EXISTS nationality  text,
  ADD COLUMN IF NOT EXISTS languages    text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio_long     text    CHECK (char_length(bio_long) <= 1000);

-- ---------------------------------------------------------------------------
-- 2. Listings table
-- ---------------------------------------------------------------------------
CREATE TABLE listings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            text        NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  description      text        CHECK (char_length(description) <= 500),
  duration_minutes integer,    -- NULL = custom / on request
  rate             integer     NOT NULL CHECK (rate > 0),  -- stored in pence/cents
  is_active        boolean     NOT NULL DEFAULT true,
  sort_order       smallint    NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listings: public read active"
  ON listings FOR SELECT USING (is_active = true);

CREATE POLICY "listings: owner insert"
  ON listings FOR INSERT WITH CHECK (auth.uid() = provider_id);

CREATE POLICY "listings: owner update"
  ON listings FOR UPDATE USING (auth.uid() = provider_id);

CREATE POLICY "listings: owner delete"
  ON listings FOR DELETE USING (auth.uid() = provider_id);

-- Fast per-provider lookup
CREATE INDEX IF NOT EXISTS listings_provider_idx
  ON listings (provider_id, sort_order)
  WHERE is_active = true;
