-- ============================================================================
-- 039: Gender, Caters To, Weekly Availability Schedule
-- ============================================================================
-- Adds fields inspired by industry-standard platforms:
--   - gender: provider's gender identity + pronouns
--   - caters_to: array of client types the provider sees
--   - availability_schedule: JSONB weekly schedule (Mon-Sun)
--   - tagline: short catchy headline for profile
-- ============================================================================

-- Gender identity (free text for flexibility: "Woman", "Man", "Non-binary", etc.)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS gender text;

-- Pronouns (e.g. "She/Her", "He/Him", "They/Them")
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pronouns text;

-- Caters to — array of client types
-- e.g. ["Men", "Women", "Couples", "Non-binary"]
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS caters_to text[] NOT NULL DEFAULT '{}';

-- Weekly availability schedule — JSONB
-- Format: { "monday": "All day", "tuesday": "10am - 8pm", "saturday": "Unavailable", ... }
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS availability_schedule jsonb;

-- Short tagline / headline for profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tagline text;
