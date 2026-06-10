-- =============================================================================
-- Cleopatra — Migration 080: Make signup resilient to username collisions
-- The original handle_new_user() set username = email prefix with only
-- ON CONFLICT (id). When that email prefix is already taken by another profile
-- (seed data or a prior signup), the INSERT violates profiles_username_key and
-- Supabase reports "Database error saving new user".
--
-- This version sanitises the email prefix and appends a numeric suffix until the
-- username is unique, so signup never fails on a username clash.
-- =============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username  text;
  final_username text;
  suffix         integer := 0;
BEGIN
  -- Sanitise the email prefix to allowed username characters.
  base_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  IF base_username IS NULL OR base_username = '' THEN
    base_username := 'user';
  END IF;

  final_username := base_username;

  -- Append a numeric suffix until the username is free.
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  END LOOP;

  INSERT INTO profiles (id, username)
  VALUES (NEW.id, final_username)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
