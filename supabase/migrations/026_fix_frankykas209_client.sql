-- =============================================================================
-- Cleopatra — Migration 026: Fix frankykas209 account type
-- Change frankykas209 from provider to client.
-- =============================================================================

UPDATE profiles
SET is_provider = false
WHERE username = 'frankykas209';
