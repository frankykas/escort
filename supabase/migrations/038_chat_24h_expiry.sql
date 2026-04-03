-- ============================================================================
-- 038: 24-hour chat expiry — no messages retained on server
-- ============================================================================
-- Channels and all associated data (members, messages) are automatically
-- deleted 24 hours after the channel was created (i.e. when the request
-- was accepted). This ensures zero server-side message retention.
--
-- Requires pg_cron extension (enabled by default on Supabase).
-- The job runs every 15 minutes and deletes expired channels.
-- ON DELETE CASCADE on chat_channel_members and chat_messages ensures
-- all related rows are removed.
-- ============================================================================

-- ── Cleanup function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_chats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  -- Delete channels older than 24 hours
  -- ON DELETE CASCADE handles members + messages
  DELETE FROM chat_channels
  WHERE created_at < now() - interval '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted > 0 THEN
    RAISE NOTICE 'Cleaned up % expired chat channel(s)', v_deleted;
  END IF;
END;
$$;

-- ── Schedule the cleanup every 15 minutes via pg_cron ──────────────────────
-- NOTE: Run this in the Supabase SQL Editor manually if pg_cron is available:
--
--   SELECT cron.schedule(
--     'cleanup-expired-chats',
--     '*/15 * * * *',
--     $$SELECT cleanup_expired_chats()$$
--   );
--
-- pg_cron may not be available in all Supabase plans. If not, you can call
-- cleanup_expired_chats() from an external cron (e.g. Vercel Cron) via:
--   POST /rest/v1/rpc/cleanup_expired_chats
