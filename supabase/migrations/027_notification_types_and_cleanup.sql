-- =============================================================================
-- Cleopatra — Migration 027: Add message request notification types,
-- remove review-related items
-- =============================================================================

-- ── Add new notification types ──────────────────────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

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
    'new_message',
    'message_request',
    'message_request_accepted'
  ));

-- ── Add message_request to reference_type ───────────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_reference_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_reference_type_check CHECK (reference_type IN (
    'booking', 'post', 'message', 'profile', 'message_request'
  ));

-- ── Remove review trigger (no longer needed) ────────────────────────────────

DROP TRIGGER IF EXISTS on_review_notify ON reviews;
DROP FUNCTION IF EXISTS notify_review_received();
