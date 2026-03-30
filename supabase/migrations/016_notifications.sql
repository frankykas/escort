-- =============================================================================
-- Cleopatra — Migration 016: In-App Notification System
--
-- Covers:
--   1. notifications table
--   2. Auto-fire triggers for all key events:
--      - Booking: requested, accepted, declined, completed, cancelled
--      - Review left on provider
--      - New follower
--      - New subscriber
--      - New like on post
--      - New comment on post
--      - New message (first in conversation)
-- =============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. NOTIFICATIONS TABLE                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE notifications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  type          text        NOT NULL CHECK (type IN (
    'booking_requested',
    'booking_accepted',
    'booking_declined',
    'booking_completed',
    'booking_cancelled',
    'review_received',
    'new_follower',
    'new_subscriber',
    'post_liked',
    'post_commented',
    'new_message'
  )),
  title         text        NOT NULL,
  body          text,
  reference_id  uuid,                     -- booking_id, post_id, review_id, etc.
  reference_type text       CHECK (reference_type IN (
    'booking', 'review', 'post', 'message', 'profile'
  )),
  is_read       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "notifications: owner read"
  ON notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications: owner update"
  ON notifications FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications: owner delete"
  ON notifications FOR DELETE
  USING (recipient_id = auth.uid());

-- Service role + triggers can insert notifications for anyone
CREATE POLICY "notifications: system insert"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- Indexes for fast inbox queries
CREATE INDEX notifications_recipient_unread_idx
  ON notifications (recipient_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX notifications_recipient_all_idx
  ON notifications (recipient_id, created_at DESC);

-- Denormalized unread count on profiles for fast badge display
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unread_notifications_count integer NOT NULL DEFAULT 0;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. HELPER: Insert a notification + bump unread count                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION create_notification(
  p_recipient_id  uuid,
  p_actor_id      uuid,
  p_type          text,
  p_title         text,
  p_body          text DEFAULT NULL,
  p_reference_id  uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Don't notify yourself
  IF p_recipient_id = p_actor_id THEN
    RETURN;
  END IF;

  INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_id, reference_type)
  VALUES (p_recipient_id, p_actor_id, p_type, p_title, p_body, p_reference_id, p_reference_type);

  UPDATE profiles
  SET unread_notifications_count = unread_notifications_count + 1
  WHERE id = p_recipient_id;
END;
$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. TRIGGERS: Booking lifecycle                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_name  text;
  provider_name text;
BEGIN
  SELECT username INTO client_name FROM profiles WHERE id = NEW.client_id;
  SELECT username INTO provider_name FROM profiles WHERE id = NEW.provider_id;

  -- New booking → notify provider
  IF TG_OP = 'INSERT' THEN
    PERFORM create_notification(
      NEW.provider_id,
      NEW.client_id,
      'booking_requested',
      'New booking request',
      client_name || ' sent you a booking request for ' || COALESCE(NEW.requested_date::text, 'a date'),
      NEW.id,
      'booking'
    );
    RETURN NEW;
  END IF;

  -- Status changes → notify the other party
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN

    -- Accepted → notify client
    IF NEW.status = 'accepted' THEN
      PERFORM create_notification(
        NEW.client_id,
        NEW.provider_id,
        'booking_accepted',
        'Booking confirmed!',
        provider_name || ' accepted your booking for ' || COALESCE(NEW.requested_date::text, 'your requested date'),
        NEW.id,
        'booking'
      );

    -- Declined → notify client
    ELSIF NEW.status = 'declined' THEN
      PERFORM create_notification(
        NEW.client_id,
        NEW.provider_id,
        'booking_declined',
        'Booking declined',
        provider_name || ' declined your booking request',
        NEW.id,
        'booking'
      );

    -- Completed → notify client
    ELSIF NEW.status = 'completed' THEN
      PERFORM create_notification(
        NEW.client_id,
        NEW.provider_id,
        'booking_completed',
        'Booking completed',
        'Your booking with ' || provider_name || ' has been marked as completed. Leave a review!',
        NEW.id,
        'booking'
      );

    -- Cancelled → notify the other party
    ELSIF NEW.status = 'cancelled' THEN
      IF NEW.cancelled_by = NEW.client_id THEN
        PERFORM create_notification(
          NEW.provider_id,
          NEW.client_id,
          'booking_cancelled',
          'Booking cancelled',
          client_name || ' cancelled their booking for ' || COALESCE(NEW.requested_date::text, 'a date'),
          NEW.id,
          'booking'
        );
      ELSE
        PERFORM create_notification(
          NEW.client_id,
          NEW.provider_id,
          'booking_cancelled',
          'Booking cancelled',
          provider_name || ' cancelled your booking for ' || COALESCE(NEW.requested_date::text, 'a date'),
          NEW.id,
          'booking'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_booking_notify
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION notify_booking_change();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. TRIGGER: Review received                                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_review_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reviewer_name text;
BEGIN
  SELECT username INTO reviewer_name FROM profiles WHERE id = NEW.reviewer_id;

  PERFORM create_notification(
    NEW.reviewee_id,
    NEW.reviewer_id,
    'review_received',
    'New review',
    reviewer_name || ' left you a ' || NEW.rating || '-star review',
    NEW.id,
    'review'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_notify
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_received();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. TRIGGER: New follower                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  follower_name text;
BEGIN
  SELECT username INTO follower_name FROM profiles WHERE id = NEW.follower_id;

  PERFORM create_notification(
    NEW.following_id,
    NEW.follower_id,
    'new_follower',
    'New follower',
    follower_name || ' started following you',
    NEW.follower_id,
    'profile'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_notify
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_follower();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. TRIGGER: New subscriber                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_new_subscriber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_name text;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT username INTO sub_name FROM profiles WHERE id = NEW.subscriber_id;

    PERFORM create_notification(
      NEW.provider_id,
      NEW.subscriber_id,
      'new_subscriber',
      'New subscriber!',
      sub_name || ' subscribed to your profile',
      NEW.subscriber_id,
      'profile'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_notify
  AFTER INSERT ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_subscriber();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. TRIGGER: Post liked                                                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_post_liked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  liker_name  text;
  post_owner  uuid;
BEGIN
  SELECT username INTO liker_name FROM profiles WHERE id = NEW.user_id;
  SELECT provider_id INTO post_owner FROM status_updates WHERE id = NEW.status_update_id;

  PERFORM create_notification(
    post_owner,
    NEW.user_id,
    'post_liked',
    'New like',
    liker_name || ' liked your post',
    NEW.status_update_id,
    'post'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_like_notify
  AFTER INSERT ON likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_liked();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  8. TRIGGER: Post commented                                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_post_commented()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  commenter_name text;
  post_owner     uuid;
  comment_preview text;
BEGIN
  SELECT username INTO commenter_name FROM profiles WHERE id = NEW.user_id;
  SELECT provider_id INTO post_owner FROM status_updates WHERE id = NEW.status_update_id;

  -- Truncate comment for preview
  comment_preview := LEFT(NEW.body, 100);
  IF length(NEW.body) > 100 THEN
    comment_preview := comment_preview || '…';
  END IF;

  PERFORM create_notification(
    post_owner,
    NEW.user_id,
    'post_commented',
    'New comment',
    commenter_name || ': ' || comment_preview,
    NEW.status_update_id,
    'post'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_commented();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  9. TRIGGER: New message (first message in conversation only)            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  recent_notif_exists boolean;
BEGIN
  SELECT username INTO sender_name FROM profiles WHERE id = NEW.sender_id;

  -- Throttle: don't spam notifications for rapid messages from same sender
  -- Only notify if no unread notification from this sender in the last 5 minutes
  SELECT EXISTS (
    SELECT 1 FROM notifications
    WHERE recipient_id = NEW.recipient_id
      AND actor_id = NEW.sender_id
      AND type = 'new_message'
      AND is_read = false
      AND created_at > now() - interval '5 minutes'
  ) INTO recent_notif_exists;

  IF NOT recent_notif_exists THEN
    PERFORM create_notification(
      NEW.recipient_id,
      NEW.sender_id,
      'new_message',
      'New message',
      sender_name || ': ' || LEFT(NEW.body, 80),
      NEW.sender_id,
      'message'
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  10. FUNCTION: Mark notifications as read + decrement count              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Mark a single notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_was_unread boolean;
BEGIN
  SELECT recipient_id, NOT is_read
  INTO v_recipient, v_was_unread
  FROM notifications
  WHERE id = p_notification_id;

  IF v_was_unread THEN
    UPDATE notifications SET is_read = true WHERE id = p_notification_id;
    UPDATE profiles
    SET unread_notifications_count = GREATEST(unread_notifications_count - 1, 0)
    WHERE id = v_recipient;
  END IF;
END;
$$;

-- Mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE recipient_id = p_user_id AND is_read = false;

  UPDATE profiles
  SET unread_notifications_count = 0
  WHERE id = p_user_id;
END;
$$;
