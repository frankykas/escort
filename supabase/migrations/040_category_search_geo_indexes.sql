-- ============================================================================
-- 040: Category Search, Full-Text Search, Geo Indexes
-- ============================================================================
-- 1. GIN index on service_categories for fast array containment queries
-- 2. Full-text search column + index on profiles
-- 3. Composite indexes for category page sort orders
-- 4. RPC for category-aware provider search with cursor pagination
-- ============================================================================

-- ── 1. GIN index for service_categories array queries ─────────────────────
CREATE INDEX IF NOT EXISTS profiles_service_categories_gin_idx
  ON profiles USING GIN (service_categories)
  WHERE is_provider = true;

-- ── 2. Full-text search ───────────────────────────────────────────────────
-- Add a tsvector column for fast text search across username, bio, tagline
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE profiles
SET search_vector = to_tsvector('english',
  COALESCE(username, '') || ' ' ||
  COALESCE(bio, '') || ' ' ||
  COALESCE(tagline, '') || ' ' ||
  COALESCE(city, '') || ' ' ||
  COALESCE(nationality, '')
)
WHERE is_provider = true;

-- GIN index for full-text search
CREATE INDEX IF NOT EXISTS profiles_search_vector_idx
  ON profiles USING GIN (search_vector)
  WHERE is_provider = true;

-- Trigger to keep search_vector updated on insert/update
CREATE OR REPLACE FUNCTION profiles_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    COALESCE(NEW.username, '') || ' ' ||
    COALESCE(NEW.bio, '') || ' ' ||
    COALESCE(NEW.tagline, '') || ' ' ||
    COALESCE(NEW.city, '') || ' ' ||
    COALESCE(NEW.nationality, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_search_vector_trigger ON profiles;
CREATE TRIGGER profiles_search_vector_trigger
  BEFORE INSERT OR UPDATE OF username, bio, tagline, city, nationality
  ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION profiles_search_vector_update();

-- ── 3. Composite indexes for sort orders ──────────────────────────────────
-- Recently active (last_seen_at)
CREATE INDEX IF NOT EXISTS profiles_last_seen_provider_idx
  ON profiles (last_seen_at DESC NULLS LAST)
  WHERE is_provider = true;

-- Newest members
CREATE INDEX IF NOT EXISTS profiles_created_provider_idx
  ON profiles (created_at DESC)
  WHERE is_provider = true;

-- Price sorting
CREATE INDEX IF NOT EXISTS profiles_rate_provider_idx
  ON profiles (hourly_rate ASC NULLS LAST)
  WHERE is_provider = true;

-- Hair color filter
CREATE INDEX IF NOT EXISTS profiles_hair_color_idx
  ON profiles (hair_color)
  WHERE is_provider = true AND hair_color IS NOT NULL;

-- Build filter
CREATE INDEX IF NOT EXISTS profiles_build_idx
  ON profiles (build)
  WHERE is_provider = true AND build IS NOT NULL;

-- Gender filter
CREATE INDEX IF NOT EXISTS profiles_gender_idx
  ON profiles (gender)
  WHERE is_provider = true AND gender IS NOT NULL;

-- ── 4. RPC for category provider search with cursor pagination ────────────
CREATE OR REPLACE FUNCTION search_category_providers(
  p_filter_type   text,          -- 'service','tag','hair','build','age_min','gender','caters_to'
  p_filter_value  text,          -- the filter value
  p_search_query  text DEFAULT NULL,  -- full-text search query
  p_city          text DEFAULT NULL,  -- city name filter
  p_lat           float8 DEFAULT NULL, -- for radius search
  p_lng           float8 DEFAULT NULL,
  p_radius_km     float8 DEFAULT 50.0,
  p_sort          text DEFAULT 'recent', -- 'recent','newest','price_asc','price_desc'
  p_limit         integer DEFAULT 20,
  p_cursor        text DEFAULT NULL  -- ISO timestamp cursor for pagination
)
RETURNS TABLE (
  id                  uuid,
  username            text,
  avatar_url          text,
  city                text,
  age                 smallint,
  verification_status text,
  tagline             text,
  hourly_rate         integer,
  available_until     timestamptz,
  distance_km         float8,
  total_count         bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cursor_ts timestamptz;
  v_total     bigint;
BEGIN
  -- Parse cursor
  IF p_cursor IS NOT NULL AND p_cursor != '' THEN
    v_cursor_ts := p_cursor::timestamptz;
  END IF;

  -- Get total count first
  SELECT COUNT(*) INTO v_total
  FROM profiles p
  WHERE p.is_provider = true
    AND (
      CASE p_filter_type
        WHEN 'service' THEN p.service_categories @> ARRAY[p_filter_value]
        WHEN 'tag'     THEN p.service_categories @> ARRAY[p_filter_value]
        WHEN 'hair'    THEN p.hair_color = p_filter_value
        WHEN 'build'   THEN p.build = p_filter_value
        WHEN 'age_min' THEN p.age >= p_filter_value::int
        WHEN 'gender'  THEN p.gender = p_filter_value
        WHEN 'caters_to' THEN p.caters_to @> ARRAY[p_filter_value]
        ELSE true
      END
    )
    AND (p_city IS NULL OR p.city ILIKE '%' || p_city || '%')
    AND (p_search_query IS NULL OR p.search_vector @@ plainto_tsquery('english', p_search_query))
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR (
        p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND (
          -- Haversine approximation for distance filtering (in km)
          6371 * ACOS(
            LEAST(1, GREATEST(-1,
              COS(RADIANS(p_lat)) * COS(RADIANS(p.lat)) *
              COS(RADIANS(p.lng) - RADIANS(p_lng)) +
              SIN(RADIANS(p_lat)) * SIN(RADIANS(p.lat))
            ))
          ) <= p_radius_km
        )
      )
    );

  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.avatar_url,
    p.city,
    p.age,
    p.verification_status::text,
    p.tagline,
    p.hourly_rate,
    p.available_until,
    CASE
      WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND p.lat IS NOT NULL AND p.lng IS NOT NULL THEN
        ROUND((
          6371 * ACOS(
            LEAST(1, GREATEST(-1,
              COS(RADIANS(p_lat)) * COS(RADIANS(p.lat)) *
              COS(RADIANS(p.lng) - RADIANS(p_lng)) +
              SIN(RADIANS(p_lat)) * SIN(RADIANS(p.lat))
            ))
          )
        )::numeric, 1)::float8
      ELSE NULL
    END AS distance_km,
    v_total AS total_count
  FROM profiles p
  WHERE p.is_provider = true
    AND (
      CASE p_filter_type
        WHEN 'service' THEN p.service_categories @> ARRAY[p_filter_value]
        WHEN 'tag'     THEN p.service_categories @> ARRAY[p_filter_value]
        WHEN 'hair'    THEN p.hair_color = p_filter_value
        WHEN 'build'   THEN p.build = p_filter_value
        WHEN 'age_min' THEN p.age >= p_filter_value::int
        WHEN 'gender'  THEN p.gender = p_filter_value
        WHEN 'caters_to' THEN p.caters_to @> ARRAY[p_filter_value]
        ELSE true
      END
    )
    AND (p_city IS NULL OR p.city ILIKE '%' || p_city || '%')
    AND (p_search_query IS NULL OR p.search_vector @@ plainto_tsquery('english', p_search_query))
    AND (
      p_lat IS NULL OR p_lng IS NULL
      OR (
        p.lat IS NOT NULL AND p.lng IS NOT NULL
        AND (
          6371 * ACOS(
            LEAST(1, GREATEST(-1,
              COS(RADIANS(p_lat)) * COS(RADIANS(p.lat)) *
              COS(RADIANS(p.lng) - RADIANS(p_lng)) +
              SIN(RADIANS(p_lat)) * SIN(RADIANS(p.lat))
            ))
          ) <= p_radius_km
        )
      )
    )
    AND (
      v_cursor_ts IS NULL
      OR (
        CASE p_sort
          WHEN 'recent'     THEN p.last_seen_at < v_cursor_ts
          WHEN 'newest'     THEN p.created_at < v_cursor_ts
          WHEN 'price_asc'  THEN true  -- no cursor for price sort, use offset
          WHEN 'price_desc' THEN true
          ELSE p.last_seen_at < v_cursor_ts
        END
      )
    )
  ORDER BY
    CASE p_sort
      WHEN 'recent'     THEN p.last_seen_at END DESC NULLS LAST,
    CASE p_sort
      WHEN 'newest'     THEN p.created_at END DESC,
    CASE p_sort
      WHEN 'price_asc'  THEN p.hourly_rate END ASC NULLS LAST,
    CASE p_sort
      WHEN 'price_desc' THEN p.hourly_rate END DESC NULLS FIRST
  LIMIT p_limit;
END;
$$;
