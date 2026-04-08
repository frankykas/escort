-- ============================================================================
-- Migration 047: Persona verification fields on profiles
-- ============================================================================
-- Stores the Persona inquiry ID and status so we can track verification
-- progress without needing webhooks (for now).
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS persona_inquiry_id text,
  ADD COLUMN IF NOT EXISTS persona_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- Index for admin lookups by inquiry
CREATE INDEX IF NOT EXISTS profiles_persona_inquiry_idx
  ON profiles (persona_inquiry_id)
  WHERE persona_inquiry_id IS NOT NULL;
