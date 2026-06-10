-- ============================================================================
-- Seed: Test escort account for live preview
-- ============================================================================
-- Run this once in the Supabase SQL editor.
-- Creates a fully-formed provider account you can sign into immediately.
--
-- ─── LOGIN CREDENTIALS ───
--   Email:    test.escort@cleopatra.test
--   Password: Cleopatra2026!
-- ─────────────────────────
--
-- The script is idempotent — running it again only refreshes the data, it
-- won't create duplicates. To remove the account entirely, run:
--   DELETE FROM auth.users WHERE id = 'c1ea0001-0000-0000-0000-000000000001';
-- (cascades through profiles, listings, status_updates, etc.)
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid := 'c1ea0001-0000-0000-0000-000000000001';
  v_email   text := 'test.escort@cleopatra.test';
  v_pwd     text := 'Cleopatra2026!';
BEGIN

  -- ── 1. auth.users (the actual login row) ───────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    v_email,
    crypt(v_pwd, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('username', 'cleo.test'),
    now(), now(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    updated_at = now();

  -- ── 2. auth.identities (required for password sign-in) ─────────────────
  -- Modern Supabase requires this row alongside auth.users.
  INSERT INTO auth.identities (
    user_id, provider, provider_id, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  VALUES (
    v_user_id,
    'email',
    v_email,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    now(), now(), now()
  )
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = now();

END $$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. PROFILE — provider, verified, 100 credits, Montreal                  ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (
  id, username, avatar_url, bio,
  is_provider, verification_status,
  city, country_code, age, tagline,
  hourly_rate, service_categories,
  onboarding_completed, post_credits_balance
)
VALUES (
  'c1ea0001-0000-0000-0000-000000000001',
  'cleo.test',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  'Test account for the Cleopatra preview — feel free to poke around. Based in Montreal, available for dinners, events, and quiet nights in.',
  true,
  'verified',
  'Montreal',
  'CA',
  27,
  'Discreet, playful, unforgettable',
  30000,                           -- $300/h in cents
  ARRAY['Escorts', 'GFE', 'Dinner Date', 'Companionship'],
  true,
  100
)
ON CONFLICT (id) DO UPDATE SET
  username             = EXCLUDED.username,
  avatar_url           = EXCLUDED.avatar_url,
  bio                  = EXCLUDED.bio,
  is_provider          = EXCLUDED.is_provider,
  verification_status  = EXCLUDED.verification_status,
  city                 = EXCLUDED.city,
  country_code         = EXCLUDED.country_code,
  age                  = EXCLUDED.age,
  tagline              = EXCLUDED.tagline,
  hourly_rate          = EXCLUDED.hourly_rate,
  service_categories   = EXCLUDED.service_categories,
  onboarding_completed = EXCLUDED.onboarding_completed,
  post_credits_balance = EXCLUDED.post_credits_balance;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. LISTINGS — two live offerings                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (
  id, provider_id, title, description, duration_minutes,
  rate, service_type, perks, is_active, expires_at
)
VALUES
  ('c1ea0001-0000-0000-0000-000000000101',
   'c1ea0001-0000-0000-0000-000000000001',
   '1h GFE — Downtown Montreal',
   'A relaxed, unhurried hour together. Whether that''s drinks, conversation, or going straight to the bedroom — we set the pace.',
   60, 30000, 'GFE',
   ARRAY['Champagne included', 'Discreet entry', 'Shower available'],
   true,
   now() + interval '7 days'),

  ('c1ea0001-0000-0000-0000-000000000102',
   'c1ea0001-0000-0000-0000-000000000001',
   'Dinner Date + Overnight',
   'Pick the restaurant — I''ll pick the dress. Stays through the morning.',
   720, 180000, 'Dinner Date',
   ARRAY['Restaurant of your choice', 'Overnight stay', 'Breakfast together'],
   true,
   now() + interval '7 days')
ON CONFLICT (id) DO UPDATE SET
  title            = EXCLUDED.title,
  description      = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  rate             = EXCLUDED.rate,
  service_type     = EXCLUDED.service_type,
  perks            = EXCLUDED.perks,
  is_active        = EXCLUDED.is_active,
  expires_at       = EXCLUDED.expires_at;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. LISTING IMAGES — 3 photos per listing                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listing_images (id, listing_id, provider_id, url, sort_order)
VALUES
  -- Listing 1
  ('c1ea0001-0000-0000-0000-000000000201', 'c1ea0001-0000-0000-0000-000000000101',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800&h=1000&fit=crop', 0),
  ('c1ea0001-0000-0000-0000-000000000202', 'c1ea0001-0000-0000-0000-000000000101',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=800&h=1000&fit=crop', 1),
  ('c1ea0001-0000-0000-0000-000000000203', 'c1ea0001-0000-0000-0000-000000000101',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop', 2),

  -- Listing 2
  ('c1ea0001-0000-0000-0000-000000000204', 'c1ea0001-0000-0000-0000-000000000102',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=1000&fit=crop', 0),
  ('c1ea0001-0000-0000-0000-000000000205', 'c1ea0001-0000-0000-0000-000000000102',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop', 1),
  ('c1ea0001-0000-0000-0000-000000000206', 'c1ea0001-0000-0000-0000-000000000102',
   'c1ea0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=800&h=1000&fit=crop', 2)
ON CONFLICT (id) DO UPDATE SET
  url        = EXCLUDED.url,
  sort_order = EXCLUDED.sort_order;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. POSTS — 5 feed posts spread across the last week                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (
  id, provider_id, caption, media_url, media_type, post_type,
  likes_count, comments_count, views_count,
  created_at, expires_at, country_code
)
VALUES
  ('c1ea0001-0000-0000-0000-000000000301',
   'c1ea0001-0000-0000-0000-000000000001',
   'Back in Montreal this week ✨ DM me to set something up.',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop',
   'image', 'post', 47, 6, 312,
   now() - interval '4 hours', now() + interval '30 days', 'CA'),

  ('c1ea0001-0000-0000-0000-000000000302',
   'c1ea0001-0000-0000-0000-000000000001',
   'Sunday slow mornings are the best mornings ☕',
   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop',
   'image', 'post', 33, 4, 218,
   now() - interval '1 day', now() + interval '30 days', 'CA'),

  ('c1ea0001-0000-0000-0000-000000000303',
   'c1ea0001-0000-0000-0000-000000000001',
   'New look, same trouble 🖤',
   'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=1000&fit=crop',
   'image', 'post', 89, 12, 540,
   now() - interval '3 days', now() + interval '30 days', 'CA'),

  ('c1ea0001-0000-0000-0000-000000000304',
   'c1ea0001-0000-0000-0000-000000000001',
   'Dinner reservations for two on Friday — who''s joining?',
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=1000&fit=crop',
   'image', 'post', 21, 3, 145,
   now() - interval '5 days', now() + interval '30 days', 'CA'),

  ('c1ea0001-0000-0000-0000-000000000305',
   'c1ea0001-0000-0000-0000-000000000001',
   'Verified ✓ — yes, the badge is real.',
   'https://images.unsplash.com/photo-1504730030853-eff311f57d3c?w=800&h=1000&fit=crop',
   'image', 'post', 64, 8, 397,
   now() - interval '6 days', now() + interval '30 days', 'CA')
ON CONFLICT (id) DO UPDATE SET
  caption        = EXCLUDED.caption,
  media_url      = EXCLUDED.media_url,
  likes_count    = EXCLUDED.likes_count,
  comments_count = EXCLUDED.comments_count,
  views_count    = EXCLUDED.views_count,
  created_at     = EXCLUDED.created_at,
  expires_at     = EXCLUDED.expires_at;


-- ============================================================================
-- Done. Sign in at /auth/signin with:
--   test.escort@cleopatra.test  /  Cleopatra2026!
-- ============================================================================
