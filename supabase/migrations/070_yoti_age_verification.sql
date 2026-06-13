-- ============================================================================
-- Migration 070: Yoti age verification fields
-- ============================================================================
-- Yoti is used as a lightweight 18+ age/liveness verifier alongside Persona.
-- Persona remains the full identity/KYC verifier that controls verification_status.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS yoti_session_id text,
  ADD COLUMN IF NOT EXISTS yoti_status text,
  ADD COLUMN IF NOT EXISTS yoti_age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS yoti_age_threshold integer,
  ADD COLUMN IF NOT EXISTS yoti_age_estimate integer,
  ADD COLUMN IF NOT EXISTS yoti_last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS age_verification_status text NOT NULL DEFAULT 'none'
    CHECK (age_verification_status IN ('none', 'pending', 'verified', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS profiles_yoti_session_idx
  ON profiles (yoti_session_id)
  WHERE yoti_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_age_verification_status_idx
  ON profiles (age_verification_status);
