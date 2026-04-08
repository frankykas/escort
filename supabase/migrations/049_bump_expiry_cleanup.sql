-- ============================================================================
-- Migration 049: Bump expiry cleanup cron
-- ============================================================================
-- Flips listing_bumps.is_active = false once expires_at has passed.
--
-- WHY A BACKGROUND JOB?
--   The active-bump queries (feed, stories, SimilarProfiles) filter by
--   `is_active = true AND expires_at > now()`, so expired bumps don't leak
--   into user-facing surfaces even without cleanup. But the `is_active`
--   flag is used for analytics, admin views, and the provider's own
--   "my active bumps" list — without cleanup those views show stale data
--   forever and indexes bloat.
--
-- SCHEDULE: runs every 10 minutes. Cheap (indexed) and keeps the dashboard
-- and provider views accurate within 10 minutes of actual expiry.
-- ============================================================================


-- ── Cleanup function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cleanup_expired_bumps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deactivated integer;
BEGIN
  UPDATE listing_bumps
  SET is_active = false
  WHERE is_active = true
    AND expires_at < now();

  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  IF v_deactivated > 0 THEN
    RAISE NOTICE 'Deactivated % expired bump(s)', v_deactivated;
  END IF;
END;
$$;


-- ── Schedule every 10 minutes via pg_cron ──────────────────────────────────
-- NOTE: pg_cron is enabled by default on Supabase. If this is a fresh project,
-- enable it first:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
-- Unschedule any previous version before re-adding (idempotent re-runs):

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup_expired_bumps')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'cleanup_expired_bumps'
    );

    PERFORM cron.schedule(
      'cleanup_expired_bumps',
      '*/10 * * * *',           -- every 10 minutes
      $cron$SELECT cleanup_expired_bumps();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available — run manually or enable the extension';
  END IF;
END $$;


-- ── One-time catch-up: clean up any already-expired bumps immediately ──────

SELECT cleanup_expired_bumps();
