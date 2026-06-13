-- Seed a pending message request from @frankykas209 to @Inesetella.
-- Run in the Supabase SQL editor.

INSERT INTO message_requests (sender_id, recipient_id, intro_message, status)
SELECT s.id, r.id, 'Salut', 'pending'
FROM profiles s, profiles r
WHERE lower(s.username) = lower('frankykas209')
  AND lower(r.username) = lower('Inesetella')
ON CONFLICT (sender_id, recipient_id) DO UPDATE
SET intro_message = EXCLUDED.intro_message,
    status        = 'pending',
    updated_at    = now();

-- Optional: create the in-app notification for the recipient so it shows up
-- in their Requests tab badge right away.
INSERT INTO notifications (user_id, type, actor_id, data)
SELECT r.id, 'message_request', s.id,
       jsonb_build_object('intro_message', 'Salut', 'sender_username', s.username)
FROM profiles s, profiles r
WHERE lower(s.username) = lower('frankykas209')
  AND lower(r.username) = lower('Inesetella');
