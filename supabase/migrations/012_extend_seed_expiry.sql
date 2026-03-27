-- =============================================================================
-- Cleopatra — Migration 012: Extend seed post expiry
-- Prevents dev/demo content from disappearing after 24h.
-- Sets all existing status_updates to expire far in the future.
-- Safe to re-run (idempotent).
-- =============================================================================

UPDATE status_updates
SET expires_at = '2099-01-01 00:00:00+00'
WHERE expires_at < now() + interval '30 days';
