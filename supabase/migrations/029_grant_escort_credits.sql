-- ============================================================================
-- Migration 029: Grant 10 free credits to all escort/provider accounts
-- ============================================================================
-- One-time grant so providers can test the listing + post credit system.

UPDATE profiles
SET post_credits_balance = post_credits_balance + 10
WHERE is_provider = true;
