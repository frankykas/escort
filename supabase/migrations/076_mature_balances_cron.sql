-- =============================================================================
-- Cleopatra — Migration 076: Schedule creator-balance maturation
-- Runs mature_creator_balances() hourly so confirmed earnings move from
-- `pending` to `available` once the hold window (platform_settings
-- 'payout_hold_days', default 7) has elapsed.
--
-- Requires the pg_cron extension. On Supabase, enable it once in the dashboard
-- (Database → Extensions → pg_cron) or via the statement below.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any prior schedule of the same job so this migration is re-runnable.
DO $$
BEGIN
  PERFORM cron.unschedule('mature_creator_balances_hourly');
EXCEPTION WHEN OTHERS THEN
  -- Job didn't exist yet — ignore.
  NULL;
END $$;

-- Run at the top of every hour.
SELECT cron.schedule(
  'mature_creator_balances_hourly',
  '0 * * * *',
  $$ SELECT public.mature_creator_balances(); $$
);
