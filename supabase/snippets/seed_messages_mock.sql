-- ============================================================================
-- Seed: mock messages, profiles, posts, listings, bumps & stars for Messages UI
-- ============================================================================
-- Populates the Messages page with a realistic mix of conversations:
--   • 8 new provider profiles with avatars (personas from the redesign mockup)
--   • 2 posts (status_updates) per provider
--   • 2 listings + images per provider
--   • Mix of active listing_bumps (tier 1/2/3) + listing_stars
--   • 1 chat_channel per provider with you (varied unread counts / timestamps)
--
-- ── REQUIRED SETUP ──────────────────────────────────────────────────────────
-- Replace the `me` UUID below with your own profile's id before running.
-- Find yours in the Supabase dashboard: Auth → Users → copy your id.
-- ============================================================================

BEGIN;


-- ── Cleanup previous run (idempotent) ───────────────────────────────────────
-- Nukes ANY profile matching our target usernames OR id prefix — plus all
-- downstream rows (chats, listings, posts, message_requests, follows, likes,
-- notifications). This protects against stale partial runs where a profile
-- under a different id already owns the username we want to reuse and is
-- blocked from deletion by FK constraints (chat_channels.created_by etc).
-- The handle_new_user() trigger auto-creates a profile on auth.users insert
-- with `split_part(email, '@', 1)` as username — so email prefix collisions
-- must also be pre-cleaned.

-- Reusable inline subquery: every profile id that conflicts with this seed.
-- We inline this in each DELETE rather than using a temp table, because
-- Supabase's SQL editor sometimes runs statements in separate transactions
-- which drops ON COMMIT DROP temp tables between statements.

-- Chat subtree (delete messages → members → channels)
DELETE FROM chat_messages        WHERE channel_id IN (SELECT id FROM chat_channels WHERE created_by IN (
  SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r')
));
DELETE FROM chat_messages        WHERE sender_id IN (
  SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r')
);
DELETE FROM chat_channel_members WHERE channel_id IN (SELECT id FROM chat_channels WHERE created_by IN (
  SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r')
));
DELETE FROM chat_channel_members WHERE user_id IN (
  SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r')
);
DELETE FROM chat_channels        WHERE created_by IN (
  SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r')
);

-- Message requests
DELETE FROM message_requests
  WHERE sender_id    IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'))
     OR recipient_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));

-- Listing subtree
DELETE FROM listing_stars  WHERE provider_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
DELETE FROM listing_bumps  WHERE provider_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
DELETE FROM listing_images WHERE provider_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
DELETE FROM listings       WHERE provider_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));

-- Posts
DELETE FROM status_updates WHERE provider_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));

-- Other profile-referencing tables (guarded so missing ones don't break it)
DO $$
BEGIN
  IF to_regclass('public.follows')       IS NOT NULL THEN
    DELETE FROM follows WHERE follower_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'))
                          OR following_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
  END IF;
  IF to_regclass('public.post_likes')    IS NOT NULL THEN
    DELETE FROM post_likes WHERE user_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
  END IF;
  IF to_regclass('public.post_comments') IS NOT NULL THEN
    DELETE FROM post_comments WHERE user_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DELETE FROM notifications WHERE recipient_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'))
                                OR actor_id     IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
  END IF;
  IF to_regclass('public.blocks')        IS NOT NULL THEN
    DELETE FROM blocks WHERE blocker_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'))
                         OR blocked_id IN (SELECT id FROM profiles WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r'));
  END IF;
END $$;

-- Profiles + auth.users
DELETE FROM profiles   WHERE id::text LIKE 'a5000000-%' OR username IN ('sophia.belle','natasha.rivera','alex.k','chloe.m','hassan.b','mina.t','kenji.s','isabelle.r');
DELETE FROM auth.users WHERE id::text LIKE 'a5000000-%' OR email IN (
  'sophia.belle@cleopatra.seed','natasha.rivera@cleopatra.seed','alex.k@cleopatra.seed','chloe.m@cleopatra.seed',
  'hassan.b@cleopatra.seed','mina.t@cleopatra.seed','kenji.s@cleopatra.seed','isabelle.r@cleopatra.seed'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. AUTH USERS — 8 new providers                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  ('a5000000-0000-0000-0000-000000000001', 'sophia.belle@cleopatra.seed',    crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"sophia.belle"}',    now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000002', 'natasha.rivera@cleopatra.seed',  crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"natasha.rivera"}',  now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000003', 'alex.k@cleopatra.seed',          crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"alex.k"}',          now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000004', 'chloe.m@cleopatra.seed',         crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"chloe.m"}',         now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000005', 'hassan.b@cleopatra.seed',        crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"hassan.b"}',        now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000006', 'mina.t@cleopatra.seed',          crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"mina.t"}',          now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000007', 'kenji.s@cleopatra.seed',         crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"kenji.s"}',         now(), now(), '', 'authenticated', 'authenticated'),
  ('a5000000-0000-0000-0000-000000000008', 'isabelle.r@cleopatra.seed',      crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"isabelle.r"}',      now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. PROFILES — with avatars (Unsplash portraits)                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, tagline, onboarding_completed, post_credits_balance)
VALUES
  ('a5000000-0000-0000-0000-000000000001', 'sophia.belle',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
   'New photos just dropped. Montreal ladies taking over the feed this week.',
   true, 'verified', 'Montreal', 'CA', 26, 'Classic elegance', true, 40),

  ('a5000000-0000-0000-0000-000000000002', 'natasha.rivera',
   'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop',
   'Weekend-available companion. Warm, curious, easy to be around.',
   true, 'verified', 'Montreal', 'CA', 28, 'Weekends are mine', true, 40),

  ('a5000000-0000-0000-0000-000000000003', 'alex.k',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
   'Photographer + part-time companion. I shoot, I travel, I show up on time.',
   true, 'none', 'Toronto', 'CA', 25, 'Always framing', true, 40),

  ('a5000000-0000-0000-0000-000000000004', 'chloe.m',
   'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop',
   'Low-key, high-quality. I prefer voice notes over paragraphs.',
   true, 'verified', 'Montreal', 'CA', 24, 'Less talk, more dates', true, 40),

  ('a5000000-0000-0000-0000-000000000005', 'hassan.b',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
   'Chef turned companion. I cook, I charm, I listen.',
   true, 'none', 'Toronto', 'CA', 32, 'Dinner first', true, 40),

  ('a5000000-0000-0000-0000-000000000006', 'mina.t',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
   'Airport cafe regular. Travel dates only — meet me at the gate.',
   true, 'verified', 'Montreal', 'CA', 27, 'Duty-free darling', true, 40),

  ('a5000000-0000-0000-0000-000000000007', 'kenji.s',
   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
   'Studio photographer and discreet companion. Portfolio on request.',
   true, 'verified', 'Montreal', 'CA', 30, 'Quiet confidence', true, 40),

  ('a5000000-0000-0000-0000-000000000008', 'isabelle.r',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop',
   'Dinner dates, gallery openings, and slow evenings. No rush, ever.',
   true, 'verified', 'Montreal', 'CA', 29, 'The long way home', true, 40)
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
  onboarding_completed = EXCLUDED.onboarding_completed,
  post_credits_balance = EXCLUDED.post_credits_balance;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. STATUS UPDATES (POSTS) — 2 per provider                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, caption, media_url, media_type, post_type, likes_count, comments_count, views_count, created_at, expires_at)
VALUES
  -- sophia.belle
  ('d5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001',
   'New set just dropped. Which one is your favourite?',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop',
   'image', 'post', 58, 9, 412, now() - interval '3 hours',  now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001',
   'Sunday slow mornings in Old Montreal.',
   'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800&h=1000&fit=crop',
   'image', 'post', 34, 4, 256, now() - interval '2 days',   now() + interval '30 days'),

  -- natasha.rivera
  ('d5000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000002',
   'Weekend energy is loading. Who''s around?',
   'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&h=1000&fit=crop',
   'image', 'post', 41, 6, 318, now() - interval '8 hours',  now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-000000000002',
   'Balcony light hits different after 6pm.',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop',
   'image', 'post', 29, 3, 198, now() - interval '3 days',   now() + interval '30 days'),

  -- alex.k
  ('d5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000003',
   'Toronto rooftop shoot today. DM for the unedited set.',
   'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=800&h=1000&fit=crop',
   'image', 'post', 63, 12, 501, now() - interval '5 hours', now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000006', 'a5000000-0000-0000-0000-000000000003',
   'Behind the scenes from last week''s campaign.',
   'https://images.unsplash.com/photo-1463453091185-61582044d556?w=800&h=1000&fit=crop',
   'image', 'post', 27, 5, 189, now() - interval '4 days',   now() + interval '30 days'),

  -- chloe.m
  ('d5000000-0000-0000-0000-000000000007', 'a5000000-0000-0000-0000-000000000004',
   'Soft evenings only this week.',
   'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&h=1000&fit=crop',
   'image', 'post', 47, 7, 362, now() - interval '1 day',    now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000008', 'a5000000-0000-0000-0000-000000000004',
   'Plateau afternoons.',
   'https://images.unsplash.com/photo-1504730030853-eff311f57d3c?w=800&h=1000&fit=crop',
   'image', 'post', 22, 2, 141, now() - interval '6 days',   now() + interval '30 days'),

  -- hassan.b
  ('d5000000-0000-0000-0000-000000000009', 'a5000000-0000-0000-0000-000000000005',
   'New menu tonight. Private table, full evening.',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1000&fit=crop',
   'image', 'post', 38, 5, 274, now() - interval '11 hours', now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000010', 'a5000000-0000-0000-0000-000000000005',
   'Morning coffee before the day starts.',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop',
   'image', 'post', 19, 1, 122, now() - interval '5 days',   now() + interval '30 days'),

  -- mina.t
  ('d5000000-0000-0000-0000-000000000011', 'a5000000-0000-0000-0000-000000000006',
   'Gate B7 for the next 40 minutes if anyone wants coffee.',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop',
   'image', 'post', 52, 8, 389, now() - interval '7 hours',  now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000012', 'a5000000-0000-0000-0000-000000000006',
   'Between flights.',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop',
   'image', 'post', 31, 4, 217, now() - interval '2 days',   now() + interval '30 days'),

  -- kenji.s
  ('d5000000-0000-0000-0000-000000000013', 'a5000000-0000-0000-0000-000000000007',
   'Studio lit and ready — slot open Thursday night.',
   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop',
   'image', 'post', 44, 6, 309, now() - interval '9 hours',  now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000014', 'a5000000-0000-0000-0000-000000000007',
   'Film grain never lies.',
   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop',
   'image', 'post', 26, 3, 173, now() - interval '4 days',   now() + interval '30 days'),

  -- isabelle.r
  ('d5000000-0000-0000-0000-000000000015', 'a5000000-0000-0000-0000-000000000008',
   'Dinner reservations for two — Thursday, Friday, Saturday.',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1000&fit=crop',
   'image', 'post', 49, 7, 348, now() - interval '6 hours',  now() + interval '30 days'),
  ('d5000000-0000-0000-0000-000000000016', 'a5000000-0000-0000-0000-000000000008',
   'A long walk before a long dinner.',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=800&h=1000&fit=crop',
   'image', 'post', 33, 4, 231, now() - interval '3 days',   now() + interval '30 days')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. LISTINGS + IMAGES — 2 per provider                                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (id, provider_id, title, description, rate, duration_minutes, service_type, perks, is_active, expires_at, created_at)
VALUES
  -- sophia.belle
  ('b5000000-0000-0000-0000-000000000001', 'a5000000-0000-0000-0000-000000000001',
   'Classic GFE',          'Elegant company for evenings that don''t rush.',
   42000, 90,  'GFE',          ARRAY['Incall','No rush','Downtown MTL'], true, now() + interval '7 days', now() - interval '2 hours'),
  ('b5000000-0000-0000-0000-000000000002', 'a5000000-0000-0000-0000-000000000001',
   'Dinner Companion',     'Dinner and drinks, fluent conversation, tailored evening.',
   65000, 180, 'Dinner Date',  ARRAY['Fine dining','Evening dress','Full evening'], true, now() + interval '7 days', now() - interval '1 day'),

  -- natasha.rivera
  ('b5000000-0000-0000-0000-000000000003', 'a5000000-0000-0000-0000-000000000002',
   'Weekend Escape',       'Two-day trip planning, discretion guaranteed.',
   120000, NULL,'Travel',       ARRAY['Weekend trips','Passport ready','Discreet'], true, now() + interval '7 days', now() - interval '5 hours'),
  ('b5000000-0000-0000-0000-000000000004', 'a5000000-0000-0000-0000-000000000002',
   'Cozy Night In',        'Wine, takeout, and a long conversation.',
   35000, 120, 'GFE',          ARRAY['Incall','Wine included','Plateau'], true, now() + interval '7 days', now() - interval '10 hours'),

  -- alex.k
  ('b5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000003',
   'Portfolio Date',       'Shoot + date combo — walk around Toronto, I take the photos.',
   40000, 120, 'Companionship',ARRAY['Downtown TO','Photos included','Creative'], true, now() + interval '7 days', now() - interval '3 hours'),
  ('b5000000-0000-0000-0000-000000000006', 'a5000000-0000-0000-0000-000000000003',
   'Event Plus One',       'Discreet plus-one for openings, launches, galas.',
   55000, 240, 'Companionship',ARRAY['Black tie','Quiet presence','Tall'], true, now() + interval '7 days', now() - interval '2 days'),

  -- chloe.m
  ('b5000000-0000-0000-0000-000000000007', 'a5000000-0000-0000-0000-000000000004',
   'Quiet Afternoon',      'Short visits, soft lights, no watch-checking.',
   28000, 60,  'GFE',          ARRAY['Incall','Daytime','Plateau'], true, now() + interval '7 days', now() - interval '1 hour'),
  ('b5000000-0000-0000-0000-000000000008', 'a5000000-0000-0000-0000-000000000004',
   'Full Evening',         'Dinner + after — slow, unhurried, attentive.',
   75000, 240, 'Dinner Date',  ARRAY['Full evening','Downtown MTL','Discreet'], true, now() + interval '7 days', now() - interval '3 days'),

  -- hassan.b
  ('b5000000-0000-0000-0000-000000000009', 'a5000000-0000-0000-0000-000000000005',
   'Private Chef + Date',  'I cook in your kitchen, we eat, we talk.',
   60000, 180, 'Dinner Date',  ARRAY['Private chef','Groceries included','Outcall'], true, now() + interval '7 days', now() - interval '6 hours'),
  ('b5000000-0000-0000-0000-000000000010', 'a5000000-0000-0000-0000-000000000005',
   'Conversation Hour',    'Coffee, conversation, no agenda.',
   22000, 60,  'Companionship',ARRAY['Coffee shops','Queen West','Casual'], true, now() + interval '7 days', now() - interval '4 days'),

  -- mina.t
  ('b5000000-0000-0000-0000-000000000011', 'a5000000-0000-0000-0000-000000000006',
   'Airport Layover',      'Have a layover? I''ll meet you at the terminal.',
   30000, 90,  'Companionship',ARRAY['Airport meet','Short notice','Discreet'], true, now() + interval '7 days', now() - interval '8 hours'),
  ('b5000000-0000-0000-0000-000000000012', 'a5000000-0000-0000-0000-000000000006',
   'City Trip Companion',  'Three days, one city — I travel, you plan.',
   200000, NULL,'Travel',       ARRAY['International','Full days','Passport ready'], true, now() + interval '7 days', now() - interval '2 days'),

  -- kenji.s
  ('b5000000-0000-0000-0000-000000000013', 'a5000000-0000-0000-0000-000000000007',
   'Studio Session',       'Private studio visit — photography optional.',
   45000, 90,  'GFE',          ARRAY['Studio space','Private','Discreet'], true, now() + interval '7 days', now() - interval '7 hours'),
  ('b5000000-0000-0000-0000-000000000014', 'a5000000-0000-0000-0000-000000000007',
   'Late Night Portrait',  'After-hours shoot + company. Bring wine.',
   58000, 150, 'Companionship',ARRAY['Late night','Wine','Plateau studio'], true, now() + interval '7 days', now() - interval '3 days'),

  -- isabelle.r
  ('b5000000-0000-0000-0000-000000000015', 'a5000000-0000-0000-0000-000000000008',
   'Slow Evening',         'Dinner, gallery, long walk home.',
   70000, 240, 'Dinner Date',  ARRAY['Full evening','Downtown MTL','Walking distance'], true, now() + interval '7 days', now() - interval '5 hours'),
  ('b5000000-0000-0000-0000-000000000016', 'a5000000-0000-0000-0000-000000000008',
   'Gallery Date',         'Opening night plus-one — knows the scene.',
   42000, 120, 'Companionship',ARRAY['Art scene','Discreet','Gallery friendly'], true, now() + interval '7 days', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Listing images (one per listing — reuses the avatar theme so cards have media)
INSERT INTO listing_images (listing_id, provider_id, url, sort_order)
VALUES
  ('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000002','a5000000-0000-0000-0000-000000000001','https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000002','https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000004','a5000000-0000-0000-0000-000000000002','https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000005','a5000000-0000-0000-0000-000000000003','https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000006','a5000000-0000-0000-0000-000000000003','https://images.unsplash.com/photo-1463453091185-61582044d556?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000007','a5000000-0000-0000-0000-000000000004','https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000008','a5000000-0000-0000-0000-000000000004','https://images.unsplash.com/photo-1504730030853-eff311f57d3c?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000009','a5000000-0000-0000-0000-000000000005','https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000010','a5000000-0000-0000-0000-000000000005','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000011','a5000000-0000-0000-0000-000000000006','https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000012','a5000000-0000-0000-0000-000000000006','https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000013','a5000000-0000-0000-0000-000000000007','https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000014','a5000000-0000-0000-0000-000000000007','https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000015','a5000000-0000-0000-0000-000000000008','https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1000&fit=crop',0),
  ('b5000000-0000-0000-0000-000000000016','a5000000-0000-0000-0000-000000000008','https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=800&h=1000&fit=crop',0);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. BUMPS & STARS                                                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Active bumps across tiers
INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, bumped_at, expires_at, is_active)
VALUES
  ('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001', 3, 3, now(), now() + interval '24 hours', true),
  ('b5000000-0000-0000-0000-000000000003','a5000000-0000-0000-0000-000000000002', 2, 2, now(), now() + interval '24 hours', true),
  ('b5000000-0000-0000-0000-000000000005','a5000000-0000-0000-0000-000000000003', 1, 1, now(), now() + interval '24 hours', true),
  ('b5000000-0000-0000-0000-000000000009','a5000000-0000-0000-0000-000000000005', 2, 2, now(), now() + interval '24 hours', true),
  ('b5000000-0000-0000-0000-000000000011','a5000000-0000-0000-0000-000000000006', 3, 3, now(), now() + interval '24 hours', true),
  ('b5000000-0000-0000-0000-000000000015','a5000000-0000-0000-0000-000000000008', 1, 1, now(), now() + interval '24 hours', true)
ON CONFLICT DO NOTHING;

-- Active stars (premium placement — 3h expiry)
INSERT INTO listing_stars (listing_id, provider_id, city, credits_spent, starred_at, expires_at, is_active)
VALUES
  ('b5000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000001','Montreal', 3, now() - interval '20 minutes', now() + interval '2 hours 40 minutes', true),
  ('b5000000-0000-0000-0000-000000000007','a5000000-0000-0000-0000-000000000004','Montreal', 3, now() - interval '45 minutes', now() + interval '2 hours 15 minutes', true),
  ('b5000000-0000-0000-0000-000000000013','a5000000-0000-0000-0000-000000000007','Montreal', 3, now() - interval '1 hour',     now() + interval '2 hours',            true),
  ('b5000000-0000-0000-0000-000000000005','a5000000-0000-0000-0000-000000000003','Toronto',  3, now() - interval '30 minutes', now() + interval '2 hours 30 minutes', true),
  ('b5000000-0000-0000-0000-000000000009','a5000000-0000-0000-0000-000000000005','Toronto',  3, now() - interval '15 minutes', now() + interval '2 hours 45 minutes', true);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. CHAT CHANNELS + MESSAGES  — conversations with YOU                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Unread state is driven by chat_channel_members.last_read_at for the current
-- user. To simulate unread: set `me.last_read_at` BEFORE the latest inbound
-- message. To simulate read: set it AFTER.
-- ============================================================================

DO $$
DECLARE
  -- ⚠️  REPLACE THIS with your own profile UUID before running.
  me uuid := 'bc78ec09-f636-4594-909e-5fa1945a9d8c';

  -- Helpers
  p1 uuid := 'a5000000-0000-0000-0000-000000000001'; -- sophia.belle
  p2 uuid := 'a5000000-0000-0000-0000-000000000002'; -- natasha.rivera
  p3 uuid := 'a5000000-0000-0000-0000-000000000003'; -- alex.k
  p4 uuid := 'a5000000-0000-0000-0000-000000000004'; -- chloe.m
  p5 uuid := 'a5000000-0000-0000-0000-000000000005'; -- hassan.b
  p6 uuid := 'a5000000-0000-0000-0000-000000000006'; -- mina.t
  p7 uuid := 'a5000000-0000-0000-0000-000000000007'; -- kenji.s
  p8 uuid := 'a5000000-0000-0000-0000-000000000008'; -- isabelle.r

  c1 text; c2 text; c3 text; c4 text;
  c5 text; c6 text; c7 text; c8 text;
BEGIN
  IF me = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Set the `me` UUID at the top of this DO block before running.';
  END IF;

  -- Build channel IDs (sorted concat of two UUIDs without hyphens)
  c1 := concat(LEAST(replace(me::text,'-',''), replace(p1::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p1::text,'-','')));
  c2 := concat(LEAST(replace(me::text,'-',''), replace(p2::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p2::text,'-','')));
  c3 := concat(LEAST(replace(me::text,'-',''), replace(p3::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p3::text,'-','')));
  c4 := concat(LEAST(replace(me::text,'-',''), replace(p4::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p4::text,'-','')));
  c5 := concat(LEAST(replace(me::text,'-',''), replace(p5::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p5::text,'-','')));
  c6 := concat(LEAST(replace(me::text,'-',''), replace(p6::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p6::text,'-','')));
  c7 := concat(LEAST(replace(me::text,'-',''), replace(p7::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p7::text,'-','')));
  c8 := concat(LEAST(replace(me::text,'-',''), replace(p8::text,'-','')), GREATEST(replace(me::text,'-',''), replace(p8::text,'-','')));

  -- ── Channels ──────────────────────────────────────────────────────────────
  INSERT INTO chat_channels (id, created_by, created_at) VALUES
    (c1, p1, now() - interval '3 days'),
    (c2, p2, now() - interval '2 days'),
    (c3, p3, now() - interval '4 hours'),
    (c4, p4, now() - interval '2 days'),
    (c5, p5, now() - interval '3 days'),
    (c6, p6, now() - interval '1 day'),
    (c7, p7, now() - interval '4 days'),
    (c8, p8, now() - interval '6 days')
  ON CONFLICT (id) DO NOTHING;

  -- ── Members (last_read_at sets unread state for YOU) ──────────────────────
  -- sophia: 3 unread (you haven't read since 1 hour ago)
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c1, me, now() - interval '1 hour', now() - interval '3 days'),
    (c1, p1, now(),                      now() - interval '3 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- natasha: 2 unread (PRO)
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c2, me, now() - interval '1 hour', now() - interval '2 days'),
    (c2, p2, now(),                      now() - interval '2 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- alex: 10 unread
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c3, me, now() - interval '5 hours', now() - interval '4 hours'),
    (c3, p3, now(),                       now() - interval '4 hours')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- chloe: 0 unread (read)
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c4, me, now(), now() - interval '2 days'),
    (c4, p4, now(), now() - interval '2 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- hassan: 1 unread
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c5, me, now() - interval '3 days', now() - interval '3 days'),
    (c5, p5, now(),                      now() - interval '3 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- mina: 0 unread
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c6, me, now(), now() - interval '1 day'),
    (c6, p6, now(), now() - interval '1 day')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- kenji: 0 unread
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c7, me, now(), now() - interval '4 days'),
    (c7, p7, now(), now() - interval '4 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- isabelle: 0 unread
  INSERT INTO chat_channel_members (channel_id, user_id, last_read_at, joined_at) VALUES
    (c8, me, now(), now() - interval '6 days'),
    (c8, p8, now(), now() - interval '6 days')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = EXCLUDED.last_read_at;

  -- ── Messages ──────────────────────────────────────────────────────────────

  -- sophia.belle (3 unread — ~4m ago)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c1, me, 'Hey Sophia, saw your new set — stunning.',        now() - interval '3 days'),
    (c1, p1, 'Thank you! Glad you liked them.',                  now() - interval '2 days 23 hours'),
    (c1, me, 'Are you around this weekend?',                     now() - interval '1 day'),
    (c1, p1, 'Thanks for checking out my new photos! Let me know if you''d like to book a session this week.', now() - interval '4 minutes'),
    (c1, p1, 'I have Friday evening open.',                      now() - interval '3 minutes'),
    (c1, p1, 'Or Saturday afternoon if that''s easier.',         now() - interval '2 minutes');

  -- natasha.rivera (2 unread — ~23m ago, PRO)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c2, p2, 'Hi! Saw you checked out my profile. Let me know if you have any questions.', now() - interval '2 days'),
    (c2, me, 'Hey — what''s your availability like next week?',                             now() - interval '1 day 6 hours'),
    (c2, p2, 'I''m around this weekend if you want to grab dinner.',                        now() - interval '24 minutes'),
    (c2, p2, 'Saturday night works best for me.',                                           now() - interval '23 minutes');

  -- alex.k (10 unread — 2h ago, image share)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c3, me, 'Hi Alex, are you booking new clients?', now() - interval '4 hours'),
    (c3, p3, 'Yes! What did you have in mind?',       now() - interval '3 hours 50 minutes'),
    (c3, me, 'Rooftop shoot maybe.',                   now() - interval '3 hours'),
    (c3, p3, 'Love that. I''ll send over some refs.', now() - interval '2 hours 30 minutes'),
    (c3, p3, '📷 Photo.png',                           now() - interval '2 hours 15 minutes'),
    (c3, p3, 'Here''s one from last week.',           now() - interval '2 hours 12 minutes'),
    (c3, p3, 'Let me know what vibe you want.',        now() - interval '2 hours 10 minutes'),
    (c3, p3, 'I can do Thursday or Friday evening.',   now() - interval '2 hours 8 minutes'),
    (c3, p3, 'Bring a jacket — rooftop gets cold.',    now() - interval '2 hours 5 minutes'),
    (c3, p3, 'Also, do you want the unedited set?',    now() - interval '2 hours 3 minutes'),
    (c3, p3, 'I can AirDrop everything after.',        now() - interval '2 hours 1 minute'),
    (c3, p3, 'Let me know!',                           now() - interval '2 hours');

  -- chloe.m (0 unread — yesterday, audio)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c4, me, 'Evening looks good — what time?',      now() - interval '2 days'),
    (c4, p4, 'Whenever works for you.',              now() - interval '1 day 22 hours'),
    (c4, me, 'Let''s say 8.',                         now() - interval '1 day 18 hours'),
    (c4, p4, '🎙️ Voice message — 1:14',              now() - interval '1 day 2 hours'),
    (c4, p4, 'Looking forward to tonight.',          now() - interval '1 day 1 hour');

  -- hassan.b (1 unread — 2 days ago)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c5, me, 'Hassan — friend recommended your dinner service.', now() - interval '3 days'),
    (c5, p5, 'Oh amazing, who was it?',                           now() - interval '2 days 20 hours'),
    (c5, me, 'Jamie R.',                                          now() - interval '2 days 18 hours'),
    (c5, p5, 'Thanks for the recommendation! Meeting sounds good — when are you free?', now() - interval '2 days');

  -- mina.t (0 unread — yesterday)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c6, p6, 'Flying into MTL tonight — coffee tomorrow?', now() - interval '1 day 4 hours'),
    (c6, me, 'Yes, 11am?',                                  now() - interval '1 day 3 hours'),
    (c6, p6, 'I''m at the Airport cafe — come find me!',   now() - interval '1 day');

  -- kenji.s (0 unread — 3 days)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c7, me, 'Kenji, saw your studio setup — beautiful.',     now() - interval '4 days'),
    (c7, p7, 'Thanks. Thursday evening is open.',              now() - interval '3 days 12 hours'),
    (c7, p7, 'Are you still looking for a photographer?',      now() - interval '3 days');

  -- isabelle.r (0 unread — 5 days)
  INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
    (c8, p8, 'It was lovely meeting you.',                                         now() - interval '6 days'),
    (c8, me, 'Likewise. Dinner was the best I''ve had in months.',                  now() - interval '5 days 20 hours'),
    (c8, p8, 'Thank you so much for dinner last week — let''s do it again!',        now() - interval '5 days');

END $$;


COMMIT;


-- ============================================================================
-- Verification queries (run after):
--
--   SELECT COUNT(*) FROM profiles          WHERE id::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM status_updates    WHERE provider_id::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM listings          WHERE provider_id::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM listing_bumps     WHERE provider_id::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM listing_stars     WHERE provider_id::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM chat_channels     WHERE created_by::text LIKE 'a5000000-%';
--   SELECT COUNT(*) FROM chat_messages
--     WHERE channel_id IN (SELECT id FROM chat_channels WHERE created_by::text LIKE 'a5000000-%');
--
-- Expected: 8 profiles, 16 posts, 16 listings, 6 bumps, 5 stars, 8 channels,
-- ~45 messages.
-- ============================================================================
