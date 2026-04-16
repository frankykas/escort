-- ============================================================================
-- Migration 051: Tighten notifications insert policy
-- ============================================================================
-- The original policy in 016_notifications.sql allowed any authenticated user
-- to insert a notification row targeting any other user (`WITH CHECK (true)`),
-- which is a spam vector.
--
-- The DB triggers that legitimately create notifications run as
-- SECURITY DEFINER and bypass RLS, so they are unaffected. Anything else
-- that needs to insert a notification (e.g. the push send pipeline) goes
-- through the service role, which also bypasses RLS.
--
-- After this migration, the only ways to insert into `notifications` are:
--   1. SECURITY DEFINER triggers (booking/follow/like/comment/message/...)
--   2. The service_role key (server-side admin actions, push pipeline)
-- ============================================================================

DROP POLICY IF EXISTS "notifications: system insert" ON notifications;

CREATE POLICY "notifications: service insert"
  ON notifications FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
