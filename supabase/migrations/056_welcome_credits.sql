-- ============================================================================
-- Migration 056: Welcome credits for new members
-- ============================================================================
-- Every new provider starts with 100 free credits to explore the platform.
-- Also grants 100 credits to all existing providers for testing.
-- ============================================================================

-- Change the default so new signups get 100 credits
ALTER TABLE profiles
  ALTER COLUMN post_credits_balance SET DEFAULT 100;

-- Grant 100 credits to all existing providers (for testing)
UPDATE profiles
SET post_credits_balance = 100
WHERE is_provider = true;
