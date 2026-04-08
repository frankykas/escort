-- ============================================================================
-- Migration 050: Push Notifications
-- ============================================================================
-- Adds:
--   1. push_subscriptions table — stores Web Push endpoints per device
--   2. notification_preferences columns on profiles — user toggles
--   3. bump_expiring notification type + reminder job
--   4. Database Webhook helper (see README for dashboard setup)
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. PUSH SUBSCRIPTIONS TABLE                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text         NOT NULL UNIQUE,
  p256dh      text         NOT NULL,  -- public key for message encryption
  auth        text         NOT NULL,  -- auth secret for message encryption
  user_agent  text,                   -- device/browser (for "unsubscribe this device" UI)
  created_at  timestamptz  NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions (for the settings page)
CREATE POLICY "push_subscriptions: owner read"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own subscriptions
CREATE POLICY "push_subscriptions: owner insert"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own subscriptions (opt-out)
CREATE POLICY "push_subscriptions: owner delete"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypasses RLS for the push sender
CREATE POLICY "push_subscriptions: service_role all"
  ON push_subscriptions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Fast lookup by user when sending a push
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (user_id);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. NOTIFICATION PREFERENCES ON PROFILES                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Per-user toggles. Defaults to true so existing users receive all push types
-- until they opt out. The push sender checks these before dispatching.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_new_messages  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_new_followers boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_post_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_bookings      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_bumps         boolean NOT NULL DEFAULT true;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. ADD bump_expiring + comment_approved NOTIFICATION TYPES               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Surface any legacy rows that won't fit the new allow-list (visible in
-- migration logs / NOTICE output) so they can be cleaned up manually later.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT type, count(*) AS n
    FROM notifications
    WHERE type NOT IN (
      'booking_requested','booking_accepted','booking_declined',
      'booking_completed','booking_cancelled',
      'new_follower','new_subscriber',
      'post_liked','post_commented','comment_approved',
      'new_message','message_request','message_request_accepted',
      'bump_expiring','bump_expired'
    )
    GROUP BY type
  LOOP
    RAISE NOTICE 'Legacy notification.type "%" — % row(s) (constraint added NOT VALID)', r.type, r.n;
  END LOOP;

  FOR r IN
    SELECT reference_type, count(*) AS n
    FROM notifications
    WHERE reference_type IS NOT NULL
      AND reference_type NOT IN (
        'booking','post','message','profile','message_request','listing','comment'
      )
    GROUP BY reference_type
  LOOP
    RAISE NOTICE 'Legacy notification.reference_type "%" — % row(s) (constraint added NOT VALID)', r.reference_type, r.n;
  END LOOP;
END $$;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- NOT VALID: only enforced on new inserts/updates, leaves legacy rows alone.
-- Legacy rows can be cleaned up later then `ALTER TABLE ... VALIDATE CONSTRAINT`.
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'booking_requested',
    'booking_accepted',
    'booking_declined',
    'booking_completed',
    'booking_cancelled',
    'new_follower',
    'new_subscriber',
    'post_liked',
    'post_commented',
    'comment_approved',
    'new_message',
    'message_request',
    'message_request_accepted',
    'bump_expiring',
    'bump_expired'
  )) NOT VALID;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_reference_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_reference_type_check CHECK (reference_type IN (
    'booking', 'post', 'message', 'profile', 'message_request', 'listing', 'comment'
  )) NOT VALID;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. BUMP EXPIRING NOTIFICATION JOB                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Fires a notification 1 hour before a bump expires. We use a `expiring_notified`
-- flag on the row to ensure each bump is only notified once.

ALTER TABLE listing_bumps
  ADD COLUMN IF NOT EXISTS expiring_notified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION notify_bumps_expiring_soon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  listing_title text;
BEGIN
  FOR r IN
    SELECT id, provider_id, listing_id
    FROM listing_bumps
    WHERE is_active = true
      AND expiring_notified = false
      AND expires_at > now()
      AND expires_at < now() + interval '1 hour'
  LOOP
    SELECT title INTO listing_title FROM listings WHERE id = r.listing_id;

    PERFORM create_notification(
      r.provider_id,
      NULL,                           -- no actor (system)
      'bump_expiring',
      'Your bump expires soon',
      'The bump on "' || COALESCE(listing_title, 'your listing') || '" expires in less than an hour. Re-bump to stay promoted.',
      r.listing_id,
      'listing'
    );

    UPDATE listing_bumps SET expiring_notified = true WHERE id = r.id;
  END LOOP;
END;
$$;

-- Schedule every 15 minutes (runs alongside cleanup_expired_bumps)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('notify_bumps_expiring_soon')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'notify_bumps_expiring_soon'
    );

    PERFORM cron.schedule(
      'notify_bumps_expiring_soon',
      '*/15 * * * *',
      $cron$SELECT notify_bumps_expiring_soon();$cron$
    );
  END IF;
END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. create_notification needs to accept NULL actor_id for system msgs    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- The existing function already allows NULL actor_id — the guard
-- `IF p_recipient_id = p_actor_id` naturally passes when actor is NULL.
-- Nothing to change here; this section documents the requirement.
