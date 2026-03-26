-- =============================================================================
-- Cleopatra — Core Schema Migration 001
-- Supports: classic classifieds + social feed (status updates + proximity)
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------

-- PostGIS: required for geography columns and ST_DWithin proximity queries
CREATE EXTENSION IF NOT EXISTS postgis;


-- ---------------------------------------------------------------------------
-- 1. Custom Types
-- ---------------------------------------------------------------------------

CREATE TYPE verification_status AS ENUM ('none', 'pending', 'verified');


-- ---------------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------------

-- profiles
-- One row per auth.users entry. Automatically created via trigger (see below).
CREATE TABLE profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            text        UNIQUE NOT NULL,
  avatar_url          text,
  bio                 text,
  is_provider         boolean     NOT NULL DEFAULT false,
  verification_status verification_status NOT NULL DEFAULT 'none',
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- listings
-- Classic classifieds ads. provider_id links to the seller's profile.
CREATE TABLE listings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  price       numeric(12, 2),
  city        text,
  category    text,
  is_bumped   boolean     NOT NULL DEFAULT false,
  bumped_until timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days'
);

-- status_updates
-- Social feed posts. Expire 24 hours after creation by default.
CREATE TABLE status_updates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  caption     text,
  media_url   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '24 hours'
);

-- locations
-- Last known position of a provider, used for proximity ("nearby") queries.
-- Uses geography(Point, 4326) — WGS84 lat/lng, sphere-aware distance calcs.
CREATE TABLE locations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  last_known_coords   geography(Point, 4326) NOT NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Index for fast ST_DWithin proximity queries
CREATE INDEX locations_coords_idx ON locations USING GIST (last_known_coords);


-- ---------------------------------------------------------------------------
-- 3. Row Level Security — enable on all tables
-- ---------------------------------------------------------------------------

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations      ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 4. RLS Policies
-- ---------------------------------------------------------------------------

-- ── profiles ──────────────────────────────────────────────────────────────

-- Anyone can read verified profiles
CREATE POLICY "profiles: public read verified"
  ON profiles FOR SELECT
  USING (verification_status = 'verified');

-- Users can read their own profile regardless of status
CREATE POLICY "profiles: owner read own"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can insert their own profile (populated by trigger, but allowed explicitly)
CREATE POLICY "profiles: owner insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles: owner update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can delete their own profile (cascades to all their data)
CREATE POLICY "profiles: owner delete"
  ON profiles FOR DELETE
  USING (id = auth.uid());


-- ── listings ──────────────────────────────────────────────────────────────

-- Anyone can read all listings
CREATE POLICY "listings: public read"
  ON listings FOR SELECT
  USING (true);

-- Providers can insert their own listings
CREATE POLICY "listings: owner insert"
  ON listings FOR INSERT
  WITH CHECK (provider_id = auth.uid());

-- Providers can update their own listings
CREATE POLICY "listings: owner update"
  ON listings FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

-- Providers can delete their own listings
CREATE POLICY "listings: owner delete"
  ON listings FOR DELETE
  USING (provider_id = auth.uid());


-- ── status_updates ────────────────────────────────────────────────────────

-- Anyone can read unexpired status updates
CREATE POLICY "status_updates: public read unexpired"
  ON status_updates FOR SELECT
  USING (expires_at > now());

-- Providers can insert their own status updates
CREATE POLICY "status_updates: owner insert"
  ON status_updates FOR INSERT
  WITH CHECK (provider_id = auth.uid());

-- Providers can update their own status updates
CREATE POLICY "status_updates: owner update"
  ON status_updates FOR UPDATE
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());

-- Providers can delete their own status updates
CREATE POLICY "status_updates: owner delete"
  ON status_updates FOR DELETE
  USING (provider_id = auth.uid());


-- ── locations ─────────────────────────────────────────────────────────────
-- Location data is private — no public read policy.

-- Users can insert their own location
CREATE POLICY "locations: owner insert"
  ON locations FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- Users can update their own location
CREATE POLICY "locations: owner update"
  ON locations FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Users can delete their own location
CREATE POLICY "locations: owner delete"
  ON locations FOR DELETE
  USING (profile_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 5. Auto-create profile on sign-up
-- ---------------------------------------------------------------------------
-- When Supabase creates a new auth.users row, this trigger inserts a matching
-- profiles row. Without this, foreign key inserts on listings / status_updates
-- would fail for new users.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    -- Use email prefix as default username; can be changed by the user later
    split_part(NEW.email, '@', 1)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
