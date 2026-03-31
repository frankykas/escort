-- Migration 022: Add onboarding_completed flag to profiles
-- Used to gate the onboarding flow for new users

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark all existing profiles as onboarded (they predate this feature)
UPDATE profiles SET onboarding_completed = true WHERE onboarding_completed = false;
