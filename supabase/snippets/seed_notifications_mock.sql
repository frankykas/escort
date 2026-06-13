-- ============================================================================
-- Seed: mock notifications for the Notifications page
-- ============================================================================
-- Covers every notification type a real user can receive:
--   booking_requested/accepted/declined/completed/cancelled, post_liked,
--   post_commented, new_follower, new_subscriber, new_message,
--   message_request, message_request_accepted.
--
-- Timestamps are spread across Today / Yesterday / This week / Earlier
-- so the time-group headers in the UI all show something.
--
-- ── REQUIRED SETUP ──────────────────────────────────────────────────────────
-- Replace the `me` UUID below with your own profile's id before running.
-- The mock providers come from seed_messages_mock.sql (run that first so the
-- actor_id FKs resolve).
-- ============================================================================

BEGIN;

-- Cleanup any prior run
DELETE FROM notifications
WHERE title LIKE '%[mock]%'
   OR body  LIKE '%[mock]%';


DO $$
DECLARE
  -- ⚠️  REPLACE THIS with your own profile UUID before running.
  me uuid := 'bc78ec09-f636-4594-909e-5fa1945a9d8c';

  p_sophia   uuid := 'a5000000-0000-0000-0000-000000000001';
  p_natasha  uuid := 'a5000000-0000-0000-0000-000000000002';
  p_alex     uuid := 'a5000000-0000-0000-0000-000000000003';
  p_chloe    uuid := 'a5000000-0000-0000-0000-000000000004';
  p_hassan   uuid := 'a5000000-0000-0000-0000-000000000005';
  p_mina     uuid := 'a5000000-0000-0000-0000-000000000006';
  p_kenji    uuid := 'a5000000-0000-0000-0000-000000000007';
  p_isabelle uuid := 'a5000000-0000-0000-0000-000000000008';
BEGIN
  IF me = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Set the `me` UUID at the top of this DO block before running.';
  END IF;

  -- Make sure the mock providers actually exist
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_sophia) THEN
    RAISE EXCEPTION 'Mock providers not found — run seed_messages_mock.sql first.';
  END IF;

  -- ── TODAY ─────────────────────────────────────────────────────────────────

  INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_type, is_read, created_at) VALUES
  (me, p_alex,    'booking_accepted',  'Your reservation is confirmed [mock]',
     'Hey, your reservation for Sophia, Saturday 8pm, is confirmed.',
     'booking', false, now() - interval '12 minutes'),

  (me, p_chloe,   'post_commented',    'Chloé_M commented on your post [mock]',
     'Love this new set! Where was it shot?',
     'post',    false, now() - interval '38 minutes'),

  (me, p_sophia,  'post_liked',        'Sophia.Belle liked your post [mock]',
     NULL,
     'post',    false, now() - interval '1 hour 20 minutes'),

  (me, p_natasha, 'new_message',       'Natasha.Rivera sent you a message [mock]',
     'Saturday night works best for me.',
     'message', false, now() - interval '2 hours 15 minutes'),

  (me, p_hassan,  'new_follower',      'Hassan.B started following you [mock]',
     NULL,
     'profile', false, now() - interval '3 hours 40 minutes'),

  -- ── YESTERDAY ─────────────────────────────────────────────────────────────

  (me, p_mina,    'booking_requested', 'New reservation request [mock]',
     'Mina wants to book the Airport Layover listing tomorrow.',
     'booking', false, now() - interval '1 day 2 hours'),

  (me, p_kenji,   'message_request',   'Kenji.S sent a message request [mock]',
     'Hey, I liked your portfolio. Would love to chat about a collab.',
     'message_request', false, now() - interval '1 day 5 hours'),

  (me, p_isabelle,'post_commented',    'Isabelle.R commented on your post [mock]',
     'That dinner spot looks incredible — where is it?',
     'post',    true,  now() - interval '1 day 7 hours'),

  (me, p_sophia,  'new_subscriber',    'Sophia.Belle subscribed to you [mock]',
     'New premium subscriber — earn recurring revenue.',
     'profile', true,  now() - interval '1 day 10 hours'),

  -- ── THIS WEEK (2-6 days) ──────────────────────────────────────────────────

  (me, p_chloe,   'booking_completed', 'Reservation completed [mock]',
     'Your reservation with Chloé_M has been marked as completed.',
     'booking', true,  now() - interval '2 days 3 hours'),

  (me, p_alex,    'post_liked',        'Alex.K and 3 others liked your post [mock]',
     NULL,
     'post',    true,  now() - interval '3 days'),

  (me, p_natasha, 'message_request_accepted', 'Natasha.Rivera accepted your request [mock]',
     'You can now chat freely.',
     'message', true,  now() - interval '4 days'),

  (me, p_hassan,  'booking_declined',  'Reservation declined [mock]',
     'Hassan.B can''t make the requested time — try another slot.',
     'booking', true,  now() - interval '5 days'),

  (me, p_mina,    'new_follower',      'Mina.T started following you [mock]',
     NULL,
     'profile', true,  now() - interval '5 days 6 hours'),

  -- ── EARLIER (7+ days) ─────────────────────────────────────────────────────

  (me, p_kenji,   'new_subscriber',    'Kenji.S subscribed to you [mock]',
     'Welcome your newest premium subscriber.',
     'profile', true,  now() - interval '8 days'),

  (me, p_isabelle,'post_commented',    'Isabelle.R commented on your post [mock]',
     'Always a pleasure seeing these updates!',
     'post',    true,  now() - interval '10 days'),

  (me, p_sophia,  'booking_cancelled', 'Reservation cancelled [mock]',
     'The Friday booking with Sophia.Belle was cancelled.',
     'booking', true,  now() - interval '14 days'),

  (me, p_alex,    'new_message',       'Alex.K sent you a message [mock]',
     'Hey! Just circling back on the rooftop shoot.',
     'message', true,  now() - interval '18 days');

  -- Recompute the denormalized unread counter for `me`
  UPDATE profiles
  SET unread_notifications_count = (
    SELECT COUNT(*) FROM notifications WHERE recipient_id = me AND is_read = false
  )
  WHERE id = me;
END $$;


COMMIT;


-- ============================================================================
-- Verification
--
--   SELECT type, is_read, created_at FROM notifications
--     WHERE title LIKE '%[mock]%'
--     ORDER BY created_at DESC;
--
-- Expected: 18 rows spread across today / yesterday / this week / earlier,
-- with 7 unread and 11 read.
-- ============================================================================
