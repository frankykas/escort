-- ============================================================================
-- Migration 059: Full app population — makes the platform feel publicly used
-- ============================================================================
-- Adds Montreal + Calgary providers & clients, status posts with images,
-- listing images, bookings, reviews, comments, subscription tiers,
-- additional follows, and varied notifications.
-- ============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  0. DEFENSIVE GUARDS — ensure legacy triggers are gone before inserts    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- The review notification trigger from migration 016 inserts notifications with
-- type='review_received' and reference_type='review' — both removed from the
-- allow-list in migration 027. If 027 didn't fully apply in this environment,
-- the reviews INSERT below would violate the notifications check constraint.
-- Drop it defensively so this migration is idempotent against any DB state.
DROP TRIGGER IF EXISTS on_review_notify ON reviews;
DROP FUNCTION IF EXISTS notify_review_received();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. NEW PROVIDERS — Montreal (4), Calgary (3)                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Insert providers one at a time to handle both id and email conflicts gracefully
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000001', 'maya.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '45 days', '{"provider":"email","providers":["email"]}', '{"username":"maya.mtl"}', now() - interval '45 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000002', 'chloe.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '30 days', '{"provider":"email","providers":["email"]}', '{"username":"chloe.mtl"}', now() - interval '30 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000003', 'lena.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '20 days', '{"provider":"email","providers":["email"]}', '{"username":"lena.mtl"}', now() - interval '20 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000004', 'sofia.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '12 days', '{"provider":"email","providers":["email"]}', '{"username":"sofia.mtl"}', now() - interval '12 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000005', 'aria.yyc2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '38 days', '{"provider":"email","providers":["email"]}', '{"username":"aria.yyc"}', now() - interval '38 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000006', 'luna.yyc2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '25 days', '{"provider":"email","providers":["email"]}', '{"username":"luna.yyc"}', now() - interval '25 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('a4000000-0000-0000-0000-000000000007', 'isla.yyc2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '8 days', '{"provider":"email","providers":["email"]}', '{"username":"isla.yyc"}', now() - interval '8 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;


INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, tagline, onboarding_completed, post_credits_balance, incall, outcall, hourly_rate, languages, nationality, hair_color, height_cm, build, created_at)
VALUES
  -- Montreal
  ('a4000000-0000-0000-0000-000000000001', 'maya.mtl',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
   'Bilingual Montreal beauty. Upscale companionship in the heart of the Plateau. Fluent in English and French.',
   true, 'verified', 'Montreal', 'CA', 26,
   'Le luxe à la montréalaise', true, 35, true, true, 40000,
   ARRAY['French','English'], 'Canadian', 'Brown', 170, 'Athletic',
   now() - interval '45 days'),

  ('a4000000-0000-0000-0000-000000000002', 'chloe.mtl',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop',
   'Elegant and discreet. GFE specialist based in Vieux-Port. Private condo available for incall.',
   true, 'verified', 'Montreal', 'CA', 24,
   'Your secret rendez-vous', true, 28, true, false, 35000,
   ARRAY['French','English'], 'French', 'Blonde', 165, 'Slim',
   now() - interval '30 days'),

  ('a4000000-0000-0000-0000-000000000003', 'lena.mtl',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
   'New to the city, not new to the game. Tantric specialist with a warm personality.',
   true, 'none', 'Montreal', 'CA', 29,
   'Feel the energy', true, 22, true, true, 30000,
   ARRAY['English','Russian'], 'Russian', 'Red', 175, 'Curvy',
   now() - interval '20 days'),

  ('a4000000-0000-0000-0000-000000000004', 'sofia.mtl',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop',
   'Upscale dinner date companion. Love fine dining, wine, and great conversation. Available weekends.',
   true, 'verified', 'Montreal', 'CA', 31,
   'Wine, dine & unwind', true, 18, false, true, 50000,
   ARRAY['French','English','Italian'], 'Italian', 'Black', 168, 'Slim',
   now() - interval '12 days'),

  -- Calgary
  ('a4000000-0000-0000-0000-000000000005', 'aria.yyc',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop',
   'Calgary''s finest. Professional, punctual, and passionate. BDSM-friendly, GFE available.',
   true, 'verified', 'Calgary', 'CA', 25,
   'Where the Wild West gets wilder', true, 30, true, true, 35000,
   ARRAY['English'], 'Canadian', 'Blonde', 172, 'Athletic',
   now() - interval '38 days'),

  ('a4000000-0000-0000-0000-000000000006', 'luna.yyc',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop',
   'Sweet, playful, and always up for an adventure. Massage and companionship.',
   true, 'verified', 'Calgary', 'CA', 23,
   'Your next adventure starts here', true, 25, true, false, 28000,
   ARRAY['English','Spanish'], 'Colombian', 'Black', 160, 'Petite',
   now() - interval '25 days'),

  ('a4000000-0000-0000-0000-000000000007', 'isla.yyc',
   'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
   'Brand new on Cleopatra! Independent and discreet. Currently offering intro rates.',
   true, 'none', 'Calgary', 'CA', 22,
   'Fresh face, unforgettable time', true, 15, true, true, 25000,
   ARRAY['English'], 'Canadian', 'Brown', 163, 'Slim',
   now() - interval '8 days')
ON CONFLICT (id) DO UPDATE SET
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  tagline = EXCLUDED.tagline,
  incall = EXCLUDED.incall,
  outcall = EXCLUDED.outcall,
  hourly_rate = EXCLUDED.hourly_rate,
  languages = EXCLUDED.languages,
  nationality = EXCLUDED.nationality,
  hair_color = EXCLUDED.hair_color,
  height_cm = EXCLUDED.height_cm,
  build = EXCLUDED.build;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. NEW CLIENTS — Montreal (2), Calgary (2), Toronto (1)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('c3000000-0000-0000-0000-000000000001', 'alex.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '40 days', '{"provider":"email","providers":["email"]}', '{"username":"alex_mtl"}', now() - interval '40 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('c3000000-0000-0000-0000-000000000002', 'david.mtl2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '22 days', '{"provider":"email","providers":["email"]}', '{"username":"david_mtl"}', now() - interval '22 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('c3000000-0000-0000-0000-000000000003', 'james.yyc2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '35 days', '{"provider":"email","providers":["email"]}', '{"username":"james_yyc"}', now() - interval '35 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('c3000000-0000-0000-0000-000000000004', 'ryan.yyc2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '15 days', '{"provider":"email","providers":["email"]}', '{"username":"ryan_yyc"}', now() - interval '15 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;
DO $$
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
  VALUES ('c3000000-0000-0000-0000-000000000005', 'ben.to2@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now() - interval '28 days', '{"provider":"email","providers":["email"]}', '{"username":"ben_to"}', now() - interval '28 days', now(), '', 'authenticated', 'authenticated');
  EXCEPTION WHEN unique_violation THEN NULL;
END$$;

INSERT INTO profiles (id, username, bio, is_provider, city, country_code, age, onboarding_completed, post_credits_balance, created_at)
VALUES
  ('c3000000-0000-0000-0000-000000000001', 'alex_mtl', NULL, false, 'Montreal', 'CA', 34, true, 100, now() - interval '40 days'),
  ('c3000000-0000-0000-0000-000000000002', 'david_mtl', NULL, false, 'Montreal', 'CA', 29, true, 100, now() - interval '22 days'),
  ('c3000000-0000-0000-0000-000000000003', 'james_yyc', NULL, false, 'Calgary', 'CA', 41, true, 100, now() - interval '35 days'),
  ('c3000000-0000-0000-0000-000000000004', 'ryan_yyc', NULL, false, 'Calgary', 'CA', 27, true, 100, now() - interval '15 days'),
  ('c3000000-0000-0000-0000-000000000005', 'ben_to', NULL, false, 'Toronto', 'CA', 38, true, 100, now() - interval '28 days')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. LISTINGS — 2-3 per new provider                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (id, provider_id, title, description, rate, duration_minutes, service_type, perks, is_active, expires_at, created_at)
VALUES
  -- maya.mtl
  ('b4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'GFE — The Montréal Experience', 'Authentic girlfriend experience in my beautiful Plateau apartment. Wine, conversation, and genuine connection.',
   40000, 60, 'GFE', ARRAY['Incall available','Wine included','Lingerie','DFK'], true, now() + interval '5 days', now() - interval '2 days'),

  ('b4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001',
   'Dinner Date — Fine Dining', 'Join me at one of Montreal''s best restaurants. I know all the hidden gems in the city.',
   80000, 180, 'Dinner Date', ARRAY['Restaurant of your choice','Cocktails','Great conversation','Bilingual'], true, now() + interval '5 days', now() - interval '1 day'),

  ('b4000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001',
   'Overnight Escape', 'Full overnight experience. Dinner, drinks, and a memorable night together.',
   150000, 720, 'Companionship', ARRAY['Full night','Dinner included','Morning coffee','No rush'], true, now() + interval '5 days', now() - interval '3 hours'),

  -- chloe.mtl
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002',
   'Classic GFE — Vieux-Port', 'Intimate and passionate encounter in my private Old Port condo. Clean, discreet, professional.',
   35000, 60, 'GFE', ARRAY['Private condo','Shower available','No rush','BBBJ'], true, now() + interval '5 days', now() - interval '4 days'),

  ('b4000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000002',
   'Extended Rendezvous', 'Two hours of pure bliss. Enough time to really connect and enjoy each other.',
   60000, 120, 'GFE', ARRAY['Extended session','Multiple rounds','Shower available','Toys available'], true, now() + interval '5 days', now() - interval '2 days'),

  -- lena.mtl
  ('b4000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000003',
   'Tantric Massage — Full Body', 'Deep relaxation and energy healing. Full body tantric massage with happy ending.',
   30000, 90, 'Massage', ARRAY['Full body massage','Essential oils','Relaxing music','Private studio'], true, now() + interval '5 days', now() - interval '5 days'),

  ('b4000000-0000-0000-0000-000000000007', 'a4000000-0000-0000-0000-000000000003',
   'Couples Massage Experience', 'Bring your partner for a unique couples session. Tantric techniques for both.',
   50000, 120, 'Couples', ARRAY['Both partners','Tantric techniques','Oils included','Safe space'], true, now() + interval '5 days', now() - interval '3 days'),

  -- sofia.mtl
  ('b4000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004',
   'Weekend Dinner Companion', 'Available Friday and Saturday evenings. Fine dining, cocktails, and charming company.',
   50000, 180, 'Dinner Date', ARRAY['Weekend availability','Fine dining','Wine pairing','Elegant attire'], true, now() + interval '5 days', now() - interval '1 day'),

  ('b4000000-0000-0000-0000-000000000009', 'a4000000-0000-0000-0000-000000000004',
   'Travel Companion — Weekend Trip', 'Available for weekend getaways. Montreal to Tremblant, Quebec City, or wherever you''d like.',
   200000, NULL, 'Travel', ARRAY['Weekend trips','All expenses covered by client','Passport ready','Bilingual'], true, now() + interval '5 days', now() - interval '6 days'),

  -- aria.yyc
  ('b4000000-0000-0000-0000-000000000010', 'a4000000-0000-0000-0000-000000000005',
   'GFE — The Real Deal', 'Genuine chemistry, no watching the clock. Professional yet passionate.',
   35000, 60, 'GFE', ARRAY['Incall & outcall','DFK','Shower together','BBBJ'], true, now() + interval '5 days', now() - interval '3 days'),

  ('b4000000-0000-0000-0000-000000000011', 'a4000000-0000-0000-0000-000000000005',
   'Domination Session', 'Experienced dominatrix. From light play to advanced. Discuss your boundaries first.',
   40000, 60, 'Domination', ARRAY['Custom scenarios','Safe word protocol','Equipment provided','Discreet'], true, now() + interval '5 days', now() - interval '1 day'),

  ('b4000000-0000-0000-0000-000000000012', 'a4000000-0000-0000-0000-000000000005',
   'BDSM — Submissive or Dominant', 'Versatile. I can lead or follow. Let''s explore your fantasies together.',
   45000, 90, 'BDSM', ARRAY['Switch roles','Full dungeon setup','Costumes','Aftercare included'], true, now() + interval '5 days', now() - interval '5 hours'),

  -- luna.yyc
  ('b4000000-0000-0000-0000-000000000013', 'a4000000-0000-0000-0000-000000000006',
   'Relaxation Massage + More', 'Start with a professional full body massage and let things flow naturally.',
   28000, 60, 'Massage', ARRAY['Licensed masseuse','Hot stones optional','Oils included','Extras available'], true, now() + interval '5 days', now() - interval '2 days'),

  ('b4000000-0000-0000-0000-000000000014', 'a4000000-0000-0000-0000-000000000006',
   'PSE — The Full Fantasy', 'Uninhibited and adventurous. For those who want a little more excitement.',
   35000, 60, 'PSE', ARRAY['No limits discussed','Fantasy friendly','Costumes available','Toys'], true, now() + interval '5 days', now() - interval '4 days'),

  -- isla.yyc
  ('b4000000-0000-0000-0000-000000000015', 'a4000000-0000-0000-0000-000000000007',
   'Intro Special — GFE', 'New to Cleopatra! Special introductory rate. Come meet me and see what I''m about.',
   25000, 60, 'GFE', ARRAY['Intro rate','Incall available','Friendly vibe','DFK'], true, now() + interval '5 days', now() - interval '3 days'),

  ('b4000000-0000-0000-0000-000000000016', 'a4000000-0000-0000-0000-000000000007',
   '420-Friendly Hangout', 'Chill, smoke, and vibe. Perfect for a laid-back afternoon together.',
   22000, 90, '420-Friendly', ARRAY['420 provided','Music','Snacks','No pressure'], true, now() + interval '5 days', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. LISTING IMAGES — photos for all new + existing listings              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Using Unsplash photos (publicly accessible, free to use)

INSERT INTO listing_images (listing_id, provider_id, url, sort_order) VALUES
  -- maya.mtl listings
  ('b4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop', 2),
  ('b4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=1000&fit=crop', 0),

  -- chloe.mtl listings
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=800&h=1000&fit=crop', 2),
  ('b4000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1000&fit=crop', 1),

  -- lena.mtl listings
  ('b4000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000007', 'a4000000-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop', 0),

  -- sofia.mtl listings
  ('b4000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000009', 'a4000000-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800&h=1000&fit=crop', 0),

  -- aria.yyc listings
  ('b4000000-0000-0000-0000-000000000010', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000010', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000010', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1000&fit=crop', 2),
  ('b4000000-0000-0000-0000-000000000011', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000012', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000012', 'a4000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&h=1000&fit=crop', 1),

  -- luna.yyc listings
  ('b4000000-0000-0000-0000-000000000013', 'a4000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000013', 'a4000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000014', 'a4000000-0000-0000-0000-000000000006', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=1000&fit=crop', 0),

  -- isla.yyc listings
  ('b4000000-0000-0000-0000-000000000015', 'a4000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=1000&fit=crop', 0),
  ('b4000000-0000-0000-0000-000000000015', 'a4000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop', 1),
  ('b4000000-0000-0000-0000-000000000016', 'a4000000-0000-0000-0000-000000000007', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=1000&fit=crop', 0)
ON CONFLICT DO NOTHING;


-- Also add images for some existing listings from migration 055
-- (diamond.to, savannah.to, crystal.van, natasha.ott — the popular ones)
DO $$
DECLARE
  v_lid uuid;
BEGIN
  -- diamond.to listing images
  FOR v_lid IN SELECT id FROM listings WHERE provider_id = 'a3000000-0000-0000-0000-000000000001' LIMIT 2 LOOP
    INSERT INTO listing_images (listing_id, provider_id, url, sort_order) VALUES
      (v_lid, 'a3000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=1000&fit=crop', 0),
      (v_lid, 'a3000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=1000&fit=crop', 1),
      (v_lid, 'a3000000-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&h=1000&fit=crop', 2)
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- crystal.van listing images
  FOR v_lid IN SELECT id FROM listings WHERE provider_id = 'a3000000-0000-0000-0000-000000000005' LIMIT 2 LOOP
    INSERT INTO listing_images (listing_id, provider_id, url, sort_order) VALUES
      (v_lid, 'a3000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=800&h=1000&fit=crop', 0),
      (v_lid, 'a3000000-0000-0000-0000-000000000005', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&h=1000&fit=crop', 1)
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. LISTING BUMPS — promoted listings                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, bumped_at, expires_at, is_active)
VALUES
  -- VIP bumps (tier 3)
  ('b4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 3, 3, now() - interval '2 hours', now() + interval '22 hours', true),
  ('b4000000-0000-0000-0000-000000000010', 'a4000000-0000-0000-0000-000000000005', 3, 3, now() - interval '4 hours', now() + interval '20 hours', true),
  -- PRO bumps (tier 2)
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000002', 2, 2, now() - interval '6 hours', now() + interval '18 hours', true),
  ('b4000000-0000-0000-0000-000000000013', 'a4000000-0000-0000-0000-000000000006', 2, 2, now() - interval '1 hour', now() + interval '23 hours', true),
  -- HOT bumps (tier 1)
  ('b4000000-0000-0000-0000-000000000015', 'a4000000-0000-0000-0000-000000000007', 1, 1, now() - interval '3 hours', now() + interval '21 hours', true),
  ('b4000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000004', 1, 1, now() - interval '8 hours', now() + interval '16 hours', true)
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. STATUS UPDATES (POSTS) — provider photos with captions               ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, caption, media_url, media_type, post_type, likes_count, comments_count, views_count, created_at, expires_at)
VALUES
  -- maya.mtl posts
  ('d1000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'Ready for the weekend! Who wants to explore Montreal with me? 🌃',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop',
   'image', 'post', 24, 5, 187, now() - interval '6 hours', now() + interval '30 days'),

  ('d1000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001',
   'New lingerie just arrived 🖤 DM me for the details...',
   'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800&h=1000&fit=crop',
   'image', 'post', 41, 8, 312, now() - interval '2 days', now() + interval '30 days'),

  -- chloe.mtl posts
  ('d1000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000002',
   'Quiet evening in the Old Port. Sometimes the best dates are the simplest ones.',
   'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&h=1000&fit=crop',
   'image', 'post', 19, 3, 145, now() - interval '1 day', now() + interval '30 days'),

  -- aria.yyc posts
  ('d1000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000005',
   'Calgary sunsets hit different. Available tonight — check my listings! 🌅',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&h=1000&fit=crop',
   'image', 'post', 33, 6, 256, now() - interval '8 hours', now() + interval '30 days'),

  ('d1000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000005',
   'Just updated my BDSM listing with new equipment 🔗 Beginners welcome.',
   'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&h=1000&fit=crop',
   'image', 'post', 28, 4, 198, now() - interval '3 days', now() + interval '30 days'),

  -- luna.yyc posts
  ('d1000000-0000-0000-0000-000000000006', 'a4000000-0000-0000-0000-000000000006',
   'My massage table is ready and the oils are warm. Book your session today 💆‍♀️',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&h=1000&fit=crop',
   'image', 'post', 15, 2, 98, now() - interval '12 hours', now() + interval '30 days'),

  -- sofia.mtl posts
  ('d1000000-0000-0000-0000-000000000007', 'a4000000-0000-0000-0000-000000000004',
   'This weekend: available for dinner dates in Old Montreal. Italian or French? Your choice 🍷',
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800&h=1000&fit=crop',
   'image', 'post', 22, 3, 167, now() - interval '4 hours', now() + interval '30 days'),

  -- isla.yyc posts
  ('d1000000-0000-0000-0000-000000000008', 'a4000000-0000-0000-0000-000000000007',
   'Just joined Cleopatra! 🌸 Excited to meet new people. Check out my intro special.',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=1000&fit=crop',
   'image', 'post', 12, 2, 76, now() - interval '2 days', now() + interval '30 days'),

  -- diamond.to posts (existing provider)
  ('d1000000-0000-0000-0000-000000000009', 'a3000000-0000-0000-0000-000000000001',
   'VIP availability this week. Limited spots. Book early! 💎',
   'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800&h=1000&fit=crop',
   'image', 'post', 52, 11, 445, now() - interval '10 hours', now() + interval '30 days'),

  -- crystal.van posts (existing provider)
  ('d1000000-0000-0000-0000-000000000010', 'a3000000-0000-0000-0000-000000000005',
   'Vancouver rain won''t stop me. Indoor vibes only today ☔ DMs open.',
   'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=800&h=1000&fit=crop',
   'image', 'post', 37, 7, 289, now() - interval '5 hours', now() + interval '30 days')
ON CONFLICT (id) DO NOTHING;


-- Stories (24h expiry) from a few active providers
INSERT INTO status_updates (id, provider_id, caption, media_url, media_type, post_type, likes_count, views_count, created_at, expires_at)
VALUES
  ('d2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'Available right now! 📍Plateau', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=1000&fit=crop',
   'image', 'story', 8, 64, now() - interval '3 hours', now() + interval '21 hours'),
  ('d2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000005',
   'Late night sessions available 🌙', 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=600&h=1000&fit=crop',
   'image', 'story', 5, 42, now() - interval '1 hour', now() + interval '23 hours'),
  ('d2000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001',
   'Diamond is back in town 💎', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&h=1000&fit=crop',
   'image', 'story', 12, 95, now() - interval '5 hours', now() + interval '19 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. COMMENTS — on popular posts                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO comments (id, status_update_id, user_id, body, created_at) VALUES
  -- Comments on maya.mtl's lingerie post
  ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001',
   'Absolutely stunning! When are you free this week?', now() - interval '1 day'),
  ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001',
   'Montreal is lucky to have you 🔥', now() - interval '23 hours'),
  ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000005',
   'Just sent you a message request!', now() - interval '20 hours'),

  -- Comments on diamond.to's VIP post
  ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000009', 'c2000000-0000-0000-0000-000000000001',
   'Best in Toronto, hands down.', now() - interval '8 hours'),
  ('e1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000009', 'c3000000-0000-0000-0000-000000000005',
   'Booked! Can''t wait 🙌', now() - interval '6 hours'),

  -- Comments on aria.yyc sunset post
  ('e1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000003',
   'The best companion in Calgary, no contest.', now() - interval '5 hours'),
  ('e1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000004',
   'Just checked your BDSM listing — very interested!', now() - interval '4 hours'),

  -- Comments on crystal.van rain post
  ('e1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000010', 'c2000000-0000-0000-0000-000000000002',
   'Coming to Vancouver next week, will definitely reach out!', now() - interval '3 hours'),

  -- Comments on isla's intro post
  ('e1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000008', 'c3000000-0000-0000-0000-000000000004',
   'Welcome to Cleopatra! The intro rate is a great deal 👍', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  8. LIKES — engagement on posts                                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO likes (user_id, status_update_id, created_at) VALUES
  -- Various clients liking various posts
  ('c3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', now() - interval '5 hours'),
  ('c3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', now() - interval '1 day'),
  ('c3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', now() - interval '6 hours'),
  ('c3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000002', now() - interval '22 hours'),
  ('c3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000003', now() - interval '18 hours'),
  ('c3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000009', now() - interval '7 hours'),
  ('c3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000004', now() - interval '7 hours'),
  ('c3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000005', now() - interval '2 days'),
  ('c3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000006', now() - interval '10 hours'),
  ('c3000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000008', now() - interval '1 day'),
  ('c3000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', now() - interval '6 hours'),
  ('c3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000009', now() - interval '8 hours'),
  ('c3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', now() - interval '4 hours'),
  ('c3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000010', now() - interval '3 hours'),
  -- Providers liking each other's posts
  ('a4000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000003', now() - interval '20 hours'),
  ('a4000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', now() - interval '5 hours'),
  ('a4000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000006', now() - interval '11 hours'),
  ('a3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000004', now() - interval '7 hours')
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  9. FOLLOWS — create a social graph                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO follows (follower_id, following_id, created_at) VALUES
  -- alex_mtl follows Montreal providers
  ('c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', now() - interval '35 days'),
  ('c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', now() - interval '28 days'),
  ('c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000003', now() - interval '15 days'),
  ('c3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', now() - interval '20 days'),

  -- david_mtl follows
  ('c3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', now() - interval '18 days'),
  ('c3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000004', now() - interval '10 days'),
  ('c3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000005', now() - interval '14 days'),

  -- james_yyc follows Calgary providers
  ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005', now() - interval '30 days'),
  ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000006', now() - interval '20 days'),
  ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000007', now() - interval '5 days'),

  -- ryan_yyc follows
  ('c3000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000005', now() - interval '12 days'),
  ('c3000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000007', now() - interval '6 days'),
  ('c3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000001', now() - interval '10 days'),

  -- ben_to follows Toronto + some cross-city
  ('c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000001', now() - interval '25 days'),
  ('c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000002', now() - interval '22 days'),
  ('c3000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000001', now() - interval '15 days'),
  ('c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000005', now() - interval '10 days'),

  -- Existing clients following new providers
  ('c2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', now() - interval '30 days'),
  ('c2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', now() - interval '20 days'),
  ('c2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000005', now() - interval '15 days'),
  ('c2000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000006', now() - interval '12 days'),

  -- Providers following each other
  ('a4000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002', now() - interval '25 days'),
  ('a4000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001', now() - interval '24 days'),
  ('a4000000-0000-0000-0000-000000000005', 'a4000000-0000-0000-0000-000000000006', now() - interval '20 days'),
  ('a3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', now() - interval '15 days')
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  10. MESSAGE REQUESTS & CONVERSATIONS                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Accepted conversations (active chats)
INSERT INTO message_requests (id, sender_id, recipient_id, intro_message, status, channel_id, created_at, updated_at) VALUES
  ('f1000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'Hi Maya! I saw your GFE listing and I''d love to book for this Friday evening. Are you available?',
   'accepted', 'a4000000000000000000000000000001c3000000000000000000000000000001',
   now() - interval '5 days', now() - interval '5 days'),

  ('f1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005',
   'Hey Aria, interested in your domination session. First timer — is that ok?',
   'accepted', 'a4000000000000000000000000000005c3000000000000000000000000000003',
   now() - interval '3 days', now() - interval '3 days'),

  ('f1000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000001',
   'Diamond, your VIP post caught my eye. What does a typical session look like?',
   'accepted', 'a3000000000000000000000000000001c3000000000000000000000000000005',
   now() - interval '2 days', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- Chat channels for accepted conversations
INSERT INTO chat_channels (id, created_by, created_at) VALUES
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'a4000000-0000-0000-0000-000000000001', now() - interval '5 days'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'a4000000-0000-0000-0000-000000000005', now() - interval '3 days'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'a3000000-0000-0000-0000-000000000001', now() - interval '2 days')
ON CONFLICT DO NOTHING;

INSERT INTO chat_channel_members (channel_id, user_id) VALUES
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'a4000000-0000-0000-0000-000000000001'),
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'c3000000-0000-0000-0000-000000000001'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'a4000000-0000-0000-0000-000000000005'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'c3000000-0000-0000-0000-000000000003'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'a3000000-0000-0000-0000-000000000001'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'c3000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- Chat messages in accepted conversations
INSERT INTO chat_messages (channel_id, sender_id, text, created_at) VALUES
  -- alex_mtl <-> maya.mtl
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'c3000000-0000-0000-0000-000000000001',
   'Hi Maya! I saw your GFE listing and I''d love to book for this Friday evening. Are you available?',
   now() - interval '5 days'),
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'a4000000-0000-0000-0000-000000000001',
   'Hi Alex! Thank you for reaching out 😊 Yes, I''m available Friday evening. What time works best for you?',
   now() - interval '5 days' + interval '20 minutes'),
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'c3000000-0000-0000-0000-000000000001',
   'How about 8pm? I was thinking incall — is your Plateau location still available?',
   now() - interval '5 days' + interval '45 minutes'),
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'a4000000-0000-0000-0000-000000000001',
   'Perfect! 8pm incall works great. I''ll send you the address on the day. Looking forward to it! 💛',
   now() - interval '5 days' + interval '1 hour'),
  ('a4000000000000000000000000000001c3000000000000000000000000000001', 'c3000000-0000-0000-0000-000000000001',
   'Sounds amazing. See you Friday!',
   now() - interval '5 days' + interval '1 hour 15 minutes'),

  -- james_yyc <-> aria.yyc
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'c3000000-0000-0000-0000-000000000003',
   'Hey Aria, interested in your domination session. First timer — is that ok?',
   now() - interval '3 days'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'a4000000-0000-0000-0000-000000000005',
   'Hey James! Absolutely, beginners are welcome. We''ll discuss your limits and boundaries beforehand so you feel completely comfortable.',
   now() - interval '3 days' + interval '30 minutes'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'c3000000-0000-0000-0000-000000000003',
   'That makes me feel better. What should I expect for a first session?',
   now() - interval '3 days' + interval '1 hour'),
  ('a4000000000000000000000000000005c3000000000000000000000000000003', 'a4000000-0000-0000-0000-000000000005',
   'We start light — blindfolds, restraints, some teasing. Nothing extreme for beginners. You''ll have a safe word at all times. Want to book for this weekend?',
   now() - interval '3 days' + interval '1 hour 30 minutes'),

  -- ben_to <-> diamond.to
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'c3000000-0000-0000-0000-000000000005',
   'Diamond, your VIP post caught my eye. What does a typical session look like?',
   now() - interval '2 days'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'a3000000-0000-0000-0000-000000000001',
   'Hi Ben! Thanks for reaching out. A typical VIP session includes a glass of champagne, a relaxing start, and then whatever feels natural. No rush, no pressure.',
   now() - interval '2 days' + interval '15 minutes'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'c3000000-0000-0000-0000-000000000005',
   'That sounds incredible. I''m interested in the 2-hour package. Available tomorrow evening?',
   now() - interval '1 day'),
  ('a3000000000000000000000000000001c3000000000000000000000000000005', 'a3000000-0000-0000-0000-000000000001',
   'Let me check my schedule... Yes! I have a 7pm slot available. Shall I book you in?',
   now() - interval '1 day' + interval '30 minutes')
ON CONFLICT DO NOTHING;

-- Pending message requests (waiting for provider response)
INSERT INTO message_requests (id, sender_id, recipient_id, intro_message, status, created_at, updated_at) VALUES
  ('f2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000001',
   'Bonjour Maya, je suis disponible cette semaine si vous l''êtes aussi. Intéressé par votre expérience GFE.',
   'pending', now() - interval '6 hours', now() - interval '6 hours'),

  ('f2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000006',
   'Hi Luna! Love your massage listing. Any availability this week?',
   'pending', now() - interval '3 hours', now() - interval '3 hours'),

  ('f2000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000004',
   'Sofia, I have a business dinner next Saturday and need a charming plus-one. Interested?',
   'pending', now() - interval '1 hour', now() - interval '1 hour'),

  ('f2000000-0000-0000-0000-000000000004', 'c2000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000005',
   'Aria, planning a trip to Calgary next month. Would love to book a session.',
   'pending', now() - interval '12 hours', now() - interval '12 hours')
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  11. BOOKINGS — completed, accepted, pending                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO bookings (id, client_id, provider_id, listing_id, requested_date, requested_time, duration_minutes, service_type, area, status, created_at, updated_at, accepted_at, completed_at) VALUES
  -- Completed bookings (past)
  ('a1000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'b4000000-0000-0000-0000-000000000001', (CURRENT_DATE - interval '10 days')::date, '20:00', 60, 'incall', 'Plateau',
   'completed', now() - interval '12 days', now() - interval '10 days', now() - interval '11 days', now() - interval '10 days'),

  ('a1000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005',
   'b4000000-0000-0000-0000-000000000010', (CURRENT_DATE - interval '7 days')::date, '19:00', 60, 'incall', 'Downtown Calgary',
   'completed', now() - interval '9 days', now() - interval '7 days', now() - interval '8 days', now() - interval '7 days'),

  ('a1000000-0000-0000-0000-000000000003', 'c2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002',
   'b4000000-0000-0000-0000-000000000004', (CURRENT_DATE - interval '5 days')::date, '21:00', 60, 'incall', 'Vieux-Port',
   'completed', now() - interval '7 days', now() - interval '5 days', now() - interval '6 days', now() - interval '5 days'),

  ('a1000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000001',
   NULL, (CURRENT_DATE - interval '3 days')::date, '19:30', 120, 'incall', 'Downtown Toronto',
   'completed', now() - interval '5 days', now() - interval '3 days', now() - interval '4 days', now() - interval '3 days'),

  -- Accepted bookings (upcoming)
  ('a1000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   'b4000000-0000-0000-0000-000000000002', (CURRENT_DATE + interval '2 days')::date, '19:30', 180, 'outcall', 'Le Plateau',
   'accepted', now() - interval '1 day', now() - interval '20 hours', now() - interval '20 hours', NULL),

  ('a1000000-0000-0000-0000-000000000006', 'c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005',
   'b4000000-0000-0000-0000-000000000012', (CURRENT_DATE + interval '3 days')::date, '21:00', 90, 'incall', 'Beltline',
   'accepted', now() - interval '2 days', now() - interval '1 day', now() - interval '1 day', NULL),

  -- Pending bookings
  ('a1000000-0000-0000-0000-000000000007', 'c3000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000007',
   'b4000000-0000-0000-0000-000000000015', (CURRENT_DATE + interval '1 day')::date, '18:00', 60, 'incall', 'Kensington',
   'pending', now() - interval '4 hours', now() - interval '4 hours', NULL, NULL),

  ('a1000000-0000-0000-0000-000000000008', 'c3000000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000003',
   'b4000000-0000-0000-0000-000000000006', (CURRENT_DATE + interval '4 days')::date, '14:00', 90, 'incall', 'Mile End',
   'pending', now() - interval '2 hours', now() - interval '2 hours', NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  12. REVIEWS — for completed bookings                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO reviews (id, booking_id, reviewer_id, reviewee_id, rating, body, is_visible, created_at) VALUES
  ('a1100000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   5, 'Maya was incredible. Warm, genuine, and made me feel completely comfortable. The Plateau apartment was beautiful. Will definitely be back!',
   true, now() - interval '9 days'),

  ('a1100000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005',
   5, 'First time trying something like this and Aria made it amazing. Very professional, patient with beginners, and the session was exactly what I needed.',
   true, now() - interval '6 days'),

  ('a1100000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   'c2000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000002',
   4, 'Chloe is a class act. Beautiful condo, very discreet, great conversation. Only wish we had more time — booking the 2-hour next time.',
   true, now() - interval '4 days'),

  ('a1100000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'c3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000001',
   5, 'Diamond lives up to the name. VIP treatment all the way. Top-tier experience in Toronto.',
   true, now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- Update provider ratings from reviews
UPDATE profiles SET average_rating = 5.00, review_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000001';
UPDATE profiles SET average_rating = 5.00, review_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000005';
UPDATE profiles SET average_rating = 4.00, review_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000002';
UPDATE profiles SET average_rating = 5.00, review_count = 2 WHERE id = 'a3000000-0000-0000-0000-000000000001';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  13. SUBSCRIPTION TIERS — some providers offer monthly subscriptions     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO subscription_tiers (id, provider_id, monthly_rate, description, perks, is_active, created_at) VALUES
  ('a1200000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001',
   2999, 'Exclusive access to my premium content, priority booking, and behind-the-scenes photos.',
   ARRAY['Premium photos weekly','Priority booking','DM access','Monthly surprise'], true, now() - interval '30 days'),

  ('a1200000-0000-0000-0000-000000000002', 'a4000000-0000-0000-0000-000000000005',
   1999, 'Support my content and get early access to new listings, special rates, and exclusive photos.',
   ARRAY['Exclusive photos','Early listing access','10% off bookings','Private stories'], true, now() - interval '25 days'),

  ('a1200000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001',
   4999, 'The Diamond Club — monthly premium content, VIP rates, and priority scheduling.',
   ARRAY['VIP booking priority','25% off sessions','Weekly premium content','Direct line access'], true, now() - interval '40 days')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  14. AVAILABILITY SCHEDULES — realistic weekly schedules                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

UPDATE profiles SET availability = '{
  "monday":    {"active": true,  "start": "18:00", "end": "23:00"},
  "tuesday":   {"active": true,  "start": "18:00", "end": "23:00"},
  "wednesday": {"active": false},
  "thursday":  {"active": true,  "start": "18:00", "end": "23:00"},
  "friday":    {"active": true,  "start": "16:00", "end": "02:00"},
  "saturday":  {"active": true,  "start": "14:00", "end": "02:00"},
  "sunday":    {"active": false}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000001';

UPDATE profiles SET availability = '{
  "monday":    {"active": false},
  "tuesday":   {"active": true,  "start": "20:00", "end": "00:00"},
  "wednesday": {"active": true,  "start": "20:00", "end": "00:00"},
  "thursday":  {"active": true,  "start": "20:00", "end": "00:00"},
  "friday":    {"active": true,  "start": "19:00", "end": "01:00"},
  "saturday":  {"active": true,  "start": "19:00", "end": "01:00"},
  "sunday":    {"active": false}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000002';

UPDATE profiles SET availability = '{
  "monday":    {"active": true,  "start": "10:00", "end": "20:00"},
  "tuesday":   {"active": true,  "start": "10:00", "end": "20:00"},
  "wednesday": {"active": true,  "start": "10:00", "end": "20:00"},
  "thursday":  {"active": true,  "start": "10:00", "end": "20:00"},
  "friday":    {"active": true,  "start": "10:00", "end": "18:00"},
  "saturday":  {"active": false},
  "sunday":    {"active": false}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000003';

UPDATE profiles SET availability = '{
  "monday":    {"active": false},
  "tuesday":   {"active": false},
  "wednesday": {"active": false},
  "thursday":  {"active": false},
  "friday":    {"active": true,  "start": "18:00", "end": "01:00"},
  "saturday":  {"active": true,  "start": "17:00", "end": "01:00"},
  "sunday":    {"active": false}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000004';

UPDATE profiles SET availability = '{
  "monday":    {"active": true,  "start": "12:00", "end": "22:00"},
  "tuesday":   {"active": true,  "start": "12:00", "end": "22:00"},
  "wednesday": {"active": true,  "start": "12:00", "end": "22:00"},
  "thursday":  {"active": true,  "start": "12:00", "end": "22:00"},
  "friday":    {"active": true,  "start": "12:00", "end": "02:00"},
  "saturday":  {"active": true,  "start": "14:00", "end": "02:00"},
  "sunday":    {"active": true,  "start": "14:00", "end": "20:00"}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000005';

UPDATE profiles SET availability = '{
  "monday":    {"active": true,  "start": "09:00", "end": "17:00"},
  "tuesday":   {"active": true,  "start": "09:00", "end": "17:00"},
  "wednesday": {"active": false},
  "thursday":  {"active": true,  "start": "09:00", "end": "17:00"},
  "friday":    {"active": true,  "start": "09:00", "end": "21:00"},
  "saturday":  {"active": true,  "start": "10:00", "end": "21:00"},
  "sunday":    {"active": false}
}'::jsonb WHERE id = 'a4000000-0000-0000-0000-000000000006';

-- Set some providers as "available now"
UPDATE profiles SET available_until = now() + interval '4 hours' WHERE id IN (
  'a4000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000005',
  'a3000000-0000-0000-0000-000000000001'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  15. NOTIFICATIONS — realistic notification feed                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_id, reference_type, is_read, created_at) VALUES
  -- New follower notifications for providers
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'new_follower',
   'New follower', 'alex_mtl started following you', 'c3000000-0000-0000-0000-000000000001', 'profile', true, now() - interval '35 days'),
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'new_follower',
   'New follower', 'david_mtl started following you', 'c3000000-0000-0000-0000-000000000002', 'profile', true, now() - interval '18 days'),
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000005', 'new_follower',
   'New follower', 'ben_to started following you', 'c3000000-0000-0000-0000-000000000005', 'profile', false, now() - interval '15 days'),

  ('a4000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000003', 'new_follower',
   'New follower', 'james_yyc started following you', 'c3000000-0000-0000-0000-000000000003', 'profile', true, now() - interval '30 days'),
  ('a4000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000004', 'new_follower',
   'New follower', 'ryan_yyc started following you', 'c3000000-0000-0000-0000-000000000004', 'profile', false, now() - interval '12 days'),

  -- Message request notifications
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'message_request',
   'New message request', 'david_mtl sent you a message request', 'f2000000-0000-0000-0000-000000000001', 'message', false, now() - interval '6 hours'),
  ('a4000000-0000-0000-0000-000000000006', 'c3000000-0000-0000-0000-000000000004', 'message_request',
   'New message request', 'ryan_yyc sent you a message request', 'f2000000-0000-0000-0000-000000000002', 'message', false, now() - interval '3 hours'),
  ('a4000000-0000-0000-0000-000000000004', 'c3000000-0000-0000-0000-000000000001', 'message_request',
   'New message request', 'alex_mtl sent you a message request', 'f2000000-0000-0000-0000-000000000003', 'message', false, now() - interval '1 hour'),

  -- Message request accepted notifications (for clients)
  ('c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'message_request_accepted',
   'Request accepted!', 'maya.mtl accepted your message request', 'f1000000-0000-0000-0000-000000000001', 'message', true, now() - interval '5 days'),
  ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005', 'message_request_accepted',
   'Request accepted!', 'aria.yyc accepted your message request', 'f1000000-0000-0000-0000-000000000002', 'message', true, now() - interval '3 days'),

  -- Post liked notifications
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'post_liked',
   'Post liked', 'alex_mtl liked your post', 'd1000000-0000-0000-0000-000000000001', 'post', true, now() - interval '5 hours'),
  ('a4000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000003', 'post_liked',
   'Post liked', 'james_yyc liked your post', 'd1000000-0000-0000-0000-000000000004', 'post', false, now() - interval '7 hours'),

  -- Comment notifications
  ('a4000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'post_commented',
   'New comment', 'alex_mtl commented on your post', 'd1000000-0000-0000-0000-000000000002', 'post', false, now() - interval '1 day'),

  -- Booking notifications
  ('a4000000-0000-0000-0000-000000000007', 'c3000000-0000-0000-0000-000000000004', 'booking_requested',
   'New booking request', 'ryan_yyc requested a booking', 'a1000000-0000-0000-0000-000000000007', 'booking', false, now() - interval '4 hours'),
  ('a4000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000002', 'booking_requested',
   'New booking request', 'david_mtl requested a booking', 'a1000000-0000-0000-0000-000000000008', 'booking', false, now() - interval '2 hours'),

  -- Booking accepted for clients
  ('c3000000-0000-0000-0000-000000000001', 'a4000000-0000-0000-0000-000000000001', 'booking_accepted',
   'Booking confirmed!', 'maya.mtl accepted your dinner date booking', 'a1000000-0000-0000-0000-000000000005', 'booking', true, now() - interval '20 hours'),
  ('c3000000-0000-0000-0000-000000000003', 'a4000000-0000-0000-0000-000000000005', 'booking_accepted',
   'Booking confirmed!', 'aria.yyc accepted your BDSM session booking', 'a1000000-0000-0000-0000-000000000006', 'booking', false, now() - interval '1 day')
ON CONFLICT DO NOTHING;

-- Update unread counts for providers with pending notifications
UPDATE profiles SET unread_notifications_count = 3 WHERE id = 'a4000000-0000-0000-0000-000000000001';
UPDATE profiles SET unread_notifications_count = 2 WHERE id = 'a4000000-0000-0000-0000-000000000005';
UPDATE profiles SET unread_notifications_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000006';
UPDATE profiles SET unread_notifications_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000004';
UPDATE profiles SET unread_notifications_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000007';
UPDATE profiles SET unread_notifications_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000003';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  16. ENRICH EXISTING PROVIDERS — add missing details                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Add details to the original migration 055 providers
UPDATE profiles SET
  incall = true, outcall = true, hourly_rate = 45000,
  languages = ARRAY['English'], nationality = 'Canadian',
  hair_color = 'Black', height_cm = 173, build = 'Athletic',
  availability = '{
    "monday": {"active": true, "start": "18:00", "end": "00:00"},
    "tuesday": {"active": true, "start": "18:00", "end": "00:00"},
    "wednesday": {"active": true, "start": "18:00", "end": "00:00"},
    "thursday": {"active": true, "start": "18:00", "end": "00:00"},
    "friday": {"active": true, "start": "16:00", "end": "02:00"},
    "saturday": {"active": true, "start": "14:00", "end": "02:00"},
    "sunday": {"active": false}
  }'::jsonb
WHERE id = 'a3000000-0000-0000-0000-000000000001';

UPDATE profiles SET
  incall = true, outcall = false, hourly_rate = 35000,
  languages = ARRAY['English','French'], nationality = 'Canadian',
  hair_color = 'Blonde', height_cm = 167, build = 'Slim'
WHERE id = 'a3000000-0000-0000-0000-000000000002';

UPDATE profiles SET
  incall = true, outcall = true, hourly_rate = 38000,
  languages = ARRAY['English','Mandarin'], nationality = 'Chinese-Canadian',
  hair_color = 'Black', height_cm = 165, build = 'Slim'
WHERE id = 'a3000000-0000-0000-0000-000000000005';

UPDATE profiles SET
  incall = true, outcall = true, hourly_rate = 32000,
  languages = ARRAY['English','Russian'], nationality = 'Russian',
  hair_color = 'Red', height_cm = 176, build = 'Athletic'
WHERE id = 'a3000000-0000-0000-0000-000000000008';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  17. UPDATE FOLLOWER + COMPLETED BOOKING COUNTS                          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

-- Update completed_bookings_count for providers with completed bookings
UPDATE profiles SET completed_bookings_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000001';
UPDATE profiles SET completed_bookings_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000005';
UPDATE profiles SET completed_bookings_count = 1 WHERE id = 'a4000000-0000-0000-0000-000000000002';
UPDATE profiles SET completed_bookings_count = 2 WHERE id = 'a3000000-0000-0000-0000-000000000001';

-- Refresh last_seen_at for all providers (simulates recent activity)
UPDATE profiles SET last_seen_at = now() - (random() * interval '6 hours')
WHERE is_provider = true AND id IN (
  'a4000000-0000-0000-0000-000000000001',
  'a4000000-0000-0000-0000-000000000002',
  'a4000000-0000-0000-0000-000000000003',
  'a4000000-0000-0000-0000-000000000004',
  'a4000000-0000-0000-0000-000000000005',
  'a4000000-0000-0000-0000-000000000006',
  'a4000000-0000-0000-0000-000000000007',
  'a3000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000002',
  'a3000000-0000-0000-0000-000000000005',
  'a3000000-0000-0000-0000-000000000008'
);
