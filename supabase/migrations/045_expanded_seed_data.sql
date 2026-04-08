-- ============================================================================
-- Migration 045: Expanded seed data
-- ============================================================================
-- Adds 8 more escort providers (6 Montreal, 2 Quebec City), 5 client accounts,
-- ~25 new feed posts with varied engagement, and approved comments from clients.
-- Also adds bookmarks table for the new save/bookmark feature.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  0. BOOKMARKS TABLE                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS bookmarks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status_update_id  uuid        NOT NULL REFERENCES status_updates(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, status_update_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bookmarks: owner read"
  ON bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bookmarks: owner insert"
  ON bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bookmarks: owner delete"
  ON bookmarks FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX bookmarks_user_idx ON bookmarks (user_id, created_at DESC);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. NEW PROVIDER AUTH USERS (8 more escorts)                             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  ('a2000000-0000-0000-0000-000000000001', 'luna.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"luna.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000002', 'aria.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"aria.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000003', 'violet.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"violet.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000004', 'scarlett.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"scarlett.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000005', 'ivy.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"ivy.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000006', 'bella.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"bella.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000007', 'rose.quebec@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"rose.quebec"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a2000000-0000-0000-0000-000000000008', 'lily.quebec@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"lily.quebec"}', now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. CLIENT AUTH USERS (5 clients who browse and comment)                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'alex.client@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"alex_mtl"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000002', 'marcus.client@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"marcus_qc"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000003', 'david.client@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"david_514"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000004', 'james.client@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"james_vip"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c1000000-0000-0000-0000-000000000005', 'ryan.client@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"ryan_mtl"}', now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  3. NEW PROVIDER PROFILES                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, tagline, onboarding_completed, post_credits_balance)
VALUES
  ('a2000000-0000-0000-0000-000000000001', 'luna.montreal',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
   'Enchanting evenings and magnetic energy. Available for upscale companionship in downtown Montreal.',
   true, 'verified', 'Montreal', 'CA', 25,
   'Your midnight muse', true, 10),

  ('a2000000-0000-0000-0000-000000000002', 'aria.montreal',
   'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop',
   'Model by day, companion by night. Tall, elegant, and unforgettable.',
   true, 'verified', 'Montreal', 'CA', 23,
   'Elegance personified', true, 10),

  ('a2000000-0000-0000-0000-000000000003', 'violet.montreal',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=200&h=200&fit=crop',
   'BDSM specialist and professional dominatrix. Safe, sane, and consensual.',
   true, 'verified', 'Montreal', 'CA', 31,
   'Bow down gracefully', true, 10),

  ('a2000000-0000-0000-0000-000000000004', 'scarlett.montreal',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop',
   'Tantric massage and holistic bodywork. Transform your energy.',
   true, 'none', 'Montreal', 'CA', 29,
   'Tantra is the way', true, 10),

  ('a2000000-0000-0000-0000-000000000005', 'ivy.montreal',
   'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=200&h=200&fit=crop',
   'PSE queen. No limits, no judgment, just pure chemistry.',
   true, 'verified', 'Montreal', 'CA', 26,
   'Chemistry is everything', true, 10),

  ('a2000000-0000-0000-0000-000000000006', 'bella.montreal',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=200&h=200&fit=crop',
   'Italian beauty, new to Montreal. Dinner dates and private encounters.',
   true, 'none', 'Montreal', 'CA', 24,
   'Ciao bello', true, 10),

  ('a2000000-0000-0000-0000-000000000007', 'rose.quebec',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=200&h=200&fit=crop',
   'Mature companion with class and experience. Quebec City exclusive.',
   true, 'verified', 'Quebec City', 'CA', 35,
   'Experience matters', true, 10),

  ('a2000000-0000-0000-0000-000000000008', 'lily.quebec',
   'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=200&h=200&fit=crop',
   'Petite, playful, and full of surprises. 420-friendly.',
   true, 'none', 'Quebec City', 'CA', 22,
   'Tiny but mighty', true, 10)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  bio = EXCLUDED.bio,
  is_provider = EXCLUDED.is_provider,
  verification_status = EXCLUDED.verification_status,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  age = EXCLUDED.age,
  tagline = EXCLUDED.tagline,
  onboarding_completed = EXCLUDED.onboarding_completed,
  post_credits_balance = EXCLUDED.post_credits_balance;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. CLIENT PROFILES                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, onboarding_completed)
VALUES
  ('c1000000-0000-0000-0000-000000000001', 'alex_mtl',
   'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Montreal', 'CA', 32, true),

  ('c1000000-0000-0000-0000-000000000002', 'marcus_qc',
   'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Quebec City', 'CA', 28, true),

  ('c1000000-0000-0000-0000-000000000003', 'david_514',
   'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Montreal', 'CA', 35, true),

  ('c1000000-0000-0000-0000-000000000004', 'james_vip',
   'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Montreal', 'CA', 41, true),

  ('c1000000-0000-0000-0000-000000000005', 'ryan_mtl',
   'https://images.unsplash.com/photo-1507591064344-4c6ce005b128?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Montreal', 'CA', 29, true)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  is_provider = EXCLUDED.is_provider,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  age = EXCLUDED.age,
  onboarding_completed = EXCLUDED.onboarding_completed;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. NEW LISTINGS (1 per new provider, first-free)                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (id, provider_id, title, description, rate, duration_minutes, service_type, perks, is_active, expires_at)
VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'Midnight Rendezvous', 'Late-night companionship for the discerning gentleman. Incall at my Griffintown loft.',
   32000, 60, 'Companionship', ARRAY['Late night', 'Incall', 'Griffintown', 'Wine included'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002',
   'Runway Experience', 'Former model offering elite companionship. Events, dinners, or private.',
   45000, 120, 'Companionship', ARRAY['Events', 'Photo-ready', 'Bilingual', 'Tall 5''10'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003',
   'Domination Session', 'Professional BDSM. Fully equipped dungeon. Beginners welcome.',
   28000, 90, 'BDSM', ARRAY['Dungeon', 'Beginners OK', 'Custom sessions', 'Safe word protocol'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000004',
   'Sacred Touch Tantric', 'Full-body tantric massage. Breathwork and energy healing included.',
   22000, 90, 'Tantric', ARRAY['Tantric', 'Breathwork', 'Energy healing', 'Plateau studio'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005',
   'PSE Ultimate', 'The real deal. Passionate, uninhibited, and unforgettable.',
   35000, 60, 'PSE', ARRAY['No restrictions', 'Incall & outcall', 'GFE upgrade', 'Repeat discount'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000006',
   'Italian Night', 'Authentic Italian charm. Cook dinner together or hit the town.',
   27000, 120, 'Dinner Date', ARRAY['Home-cooked dinner', 'Wine pairing', 'Little Italy', 'Genuine connection'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000007',
   'Mature Elegance', 'Sophisticated companionship for those who appreciate experience.',
   30000, 60, 'GFE', ARRAY['Mature', 'Experienced', 'Hotels preferred', 'Old Quebec'], true, now() + interval '24 hours'),

  ('b2000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000008',
   '420 & Chill', 'Relaxed, fun, no pressure. Bring your own or I share mine.',
   20000, 90, '420-Friendly', ARRAY['420-friendly', 'Relaxed vibe', 'Incall only', 'Netflix & chill'], true, now() + interval '24 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. NEW FEED POSTS (3 per new provider = 24 new posts)                   ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, post_type, media_type, caption, media_url, country_code, likes_count, comments_count, views_count, expires_at, created_at)
VALUES
  -- luna.montreal (3 posts)
  ('e1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'post', 'image', 'Late nights at my Griffintown loft. Who''s up? 🌙',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop',
   'CA', 89, 12, 450, '2099-01-01', now() - interval '1 hour'),

  ('e1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000001',
   'post', 'image', 'New lingerie set just arrived. Thoughts? 💫',
   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&h=600&fit=crop',
   'CA', 156, 18, 720, '2099-01-01', now() - interval '9 hours'),

  ('e1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000001',
   'post', 'image', 'Montreal skyline from my balcony tonight 🏙️',
   'https://images.unsplash.com/photo-1519181245277-cffeb31da2e3?w=600&h=600&fit=crop',
   'CA', 72, 8, 380, '2099-01-01', now() - interval '22 hours'),

  -- aria.montreal (3 posts)
  ('e1000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000002',
   'post', 'image', 'Behind the scenes from today''s photoshoot 📸',
   'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&h=600&fit=crop',
   'CA', 234, 25, 1100, '2099-01-01', now() - interval '2 hours'),

  ('e1000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000002',
   'post', 'image', 'Runway to your doorstep. Booking this weekend 👠',
   'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=600&h=600&fit=crop',
   'CA', 178, 15, 890, '2099-01-01', now() - interval '11 hours'),

  ('e1000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000002',
   'post', 'image', 'Brunch in the Plateau, then whatever you desire 🥂',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=600&fit=crop',
   'CA', 95, 7, 510, '2099-01-01', now() - interval '28 hours'),

  -- violet.montreal (2 posts)
  ('e1000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000003',
   'post', 'image', 'New dungeon setup complete. Come test it out 🖤',
   'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=600&fit=crop',
   'CA', 67, 9, 340, '2099-01-01', now() - interval '3 hours'),

  ('e1000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000003',
   'post', 'image', 'Your safe word won''t save you from wanting more 😈',
   'https://images.unsplash.com/photo-1516726817505-f5ed825624d8?w=600&h=600&fit=crop',
   'CA', 112, 14, 580, '2099-01-01', now() - interval '15 hours'),

  -- scarlett.montreal (3 posts)
  ('e1000000-0000-0000-0000-000000000009', 'a2000000-0000-0000-0000-000000000004',
   'post', 'image', 'Tantric energy session this evening. Spots open 🕯️',
   'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=600&fit=crop',
   'CA', 43, 5, 230, '2099-01-01', now() - interval '4 hours'),

  ('e1000000-0000-0000-0000-000000000010', 'a2000000-0000-0000-0000-000000000004',
   'post', 'image', 'Breathwork + bodywork = transformation 🧘‍♀️',
   'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=600&fit=crop',
   'CA', 38, 3, 195, '2099-01-01', now() - interval '19 hours'),

  ('e1000000-0000-0000-0000-000000000011', 'a2000000-0000-0000-0000-000000000004',
   'post', 'image', 'My studio is a temple. Come worship 🙏',
   'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=600&h=600&fit=crop',
   'CA', 29, 2, 150, '2099-01-01', now() - interval '36 hours'),

  -- ivy.montreal (2 posts)
  ('e1000000-0000-0000-0000-000000000012', 'a2000000-0000-0000-0000-000000000005',
   'post', 'image', 'No limits, no rules, just us. Book now 🔥',
   'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=600&h=600&fit=crop',
   'CA', 198, 22, 950, '2099-01-01', now() - interval '5 hours'),

  ('e1000000-0000-0000-0000-000000000013', 'a2000000-0000-0000-0000-000000000005',
   'post', 'image', 'Repeat clients get 10% off. Just saying 😏',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=600&fit=crop',
   'CA', 145, 16, 670, '2099-01-01', now() - interval '14 hours'),

  -- bella.montreal (3 posts)
  ('e1000000-0000-0000-0000-000000000014', 'a2000000-0000-0000-0000-000000000006',
   'post', 'image', 'Buongiorno Montreal! Italian dinner at my place tonight 🍝',
   'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&h=600&fit=crop',
   'CA', 76, 8, 390, '2099-01-01', now() - interval '6 hours'),

  ('e1000000-0000-0000-0000-000000000015', 'a2000000-0000-0000-0000-000000000006',
   'post', 'image', 'Little Italy is my playground. Join me? 🇮🇹',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=600&h=600&fit=crop',
   'CA', 54, 6, 280, '2099-01-01', now() - interval '20 hours'),

  ('e1000000-0000-0000-0000-000000000016', 'a2000000-0000-0000-0000-000000000006',
   'post', 'image', 'Homemade tiramisu after dessert... the other kind 😉',
   'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&h=600&fit=crop',
   'CA', 91, 11, 460, '2099-01-01', now() - interval '32 hours'),

  -- rose.quebec (2 posts)
  ('e1000000-0000-0000-0000-000000000017', 'a2000000-0000-0000-0000-000000000007',
   'post', 'image', 'Experience is the best teacher. Let me show you 🌹',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=600&h=600&fit=crop',
   'CA', 58, 7, 310, '2099-01-01', now() - interval '3 hours'),

  ('e1000000-0000-0000-0000-000000000018', 'a2000000-0000-0000-0000-000000000007',
   'post', 'image', 'Old Quebec has secrets. I''ll share mine 🏰',
   'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=600&h=600&fit=crop',
   'CA', 44, 4, 240, '2099-01-01', now() - interval '17 hours'),

  -- lily.quebec (3 posts)
  ('e1000000-0000-0000-0000-000000000019', 'a2000000-0000-0000-0000-000000000008',
   'post', 'image', '420 and chill tonight? Bring snacks 🍃',
   'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=600&h=600&fit=crop',
   'CA', 83, 10, 420, '2099-01-01', now() - interval '2 hours'),

  ('e1000000-0000-0000-0000-000000000020', 'a2000000-0000-0000-0000-000000000008',
   'post', 'image', 'Small but fierce. Don''t underestimate me 💪',
   'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=600&fit=crop',
   'CA', 65, 7, 350, '2099-01-01', now() - interval '13 hours'),

  ('e1000000-0000-0000-0000-000000000021', 'a2000000-0000-0000-0000-000000000008',
   'post', 'image', 'Netflix recommendations welcome. I provide the rest 📺',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=600&fit=crop',
   'CA', 47, 5, 250, '2099-01-01', now() - interval '26 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. NEW STORIES (1 per new provider)                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, post_type, media_type, caption, media_url, country_code, expires_at, created_at)
VALUES
  ('f1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   'story', 'image', 'Available after midnight 🌙',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '20 minutes'),

  ('f1000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002',
   'story', 'image', 'Photoshoot wrap 📸',
   'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '40 minutes'),

  ('f1000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000003',
   'story', 'image', 'Dungeon ready 🖤',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '1 hour'),

  ('f1000000-0000-0000-0000-000000000004', 'a2000000-0000-0000-0000-000000000004',
   'story', 'image', 'Candles lit 🕯️',
   'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '2 hours'),

  ('f1000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005',
   'story', 'image', 'Tonight is the night 🔥',
   'https://images.unsplash.com/photo-1524638431109-93d95c968f03?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '50 minutes'),

  ('f1000000-0000-0000-0000-000000000006', 'a2000000-0000-0000-0000-000000000006',
   'story', 'image', 'Cooking pasta 🍝',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '3 hours'),

  ('f1000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000007',
   'story', 'image', 'Wine o''clock 🍷',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '1 hour 30 minutes'),

  ('f1000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000008',
   'story', 'image', 'Wake and bake 🍃',
   'https://images.unsplash.com/photo-1496440737103-cd596325d314?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '5 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  8. CREDITS FOR NEW PROVIDERS                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO posting_package_purchases (provider_id, credits_purchased, credits_remaining, purchased_at, expires_at)
VALUES
  ('a2000000-0000-0000-0000-000000000001', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000002', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000003', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000004', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000005', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000006', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000007', 10, 10, now(), NULL),
  ('a2000000-0000-0000-0000-000000000008', 10, 10, now(), NULL);

-- Sync balances (trigger adds 10, profile already has 10 = 20)
UPDATE profiles SET post_credits_balance = 20
WHERE id IN (
  'a2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002',
  'a2000000-0000-0000-0000-000000000003', 'a2000000-0000-0000-0000-000000000004',
  'a2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000006',
  'a2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000008'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  9. NEW BUMPS                                                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- luna.montreal  → Tier 3 (Feed + Similar + Stories)
-- aria.montreal  → Tier 2 (Similar + Stories)
-- ivy.montreal   → Tier 3 (Feed + Similar + Stories)
-- rose.quebec    → Tier 2 (Similar + Stories)
-- lily.quebec    → Tier 1 (Stories only)

INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, bumped_at, expires_at, is_active)
VALUES
  ('b2000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001',
   3, 3, now(), now() + interval '24 hours', true),
  ('b2000000-0000-0000-0000-000000000002', 'a2000000-0000-0000-0000-000000000002',
   2, 2, now(), now() + interval '24 hours', true),
  ('b2000000-0000-0000-0000-000000000005', 'a2000000-0000-0000-0000-000000000005',
   3, 3, now(), now() + interval '24 hours', true),
  ('b2000000-0000-0000-0000-000000000007', 'a2000000-0000-0000-0000-000000000007',
   2, 2, now(), now() + interval '24 hours', true),
  ('b2000000-0000-0000-0000-000000000008', 'a2000000-0000-0000-0000-000000000008',
   1, 1, now(), now() + interval '24 hours', true);

-- Deduct bump credits
UPDATE profiles SET post_credits_balance = post_credits_balance - 3
WHERE id = 'a2000000-0000-0000-0000-000000000001'; -- luna: 20 - 3 = 17
UPDATE profiles SET post_credits_balance = post_credits_balance - 2
WHERE id = 'a2000000-0000-0000-0000-000000000002'; -- aria: 20 - 2 = 18
UPDATE profiles SET post_credits_balance = post_credits_balance - 3
WHERE id = 'a2000000-0000-0000-0000-000000000005'; -- ivy: 20 - 3 = 17
UPDATE profiles SET post_credits_balance = post_credits_balance - 2
WHERE id = 'a2000000-0000-0000-0000-000000000007'; -- rose: 20 - 2 = 18
UPDATE profiles SET post_credits_balance = post_credits_balance - 1
WHERE id = 'a2000000-0000-0000-0000-000000000008'; -- lily: 20 - 1 = 19

UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 3
WHERE provider_id = 'a2000000-0000-0000-0000-000000000001';
UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 2
WHERE provider_id = 'a2000000-0000-0000-0000-000000000002';
UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 3
WHERE provider_id = 'a2000000-0000-0000-0000-000000000005';
UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 2
WHERE provider_id = 'a2000000-0000-0000-0000-000000000007';
UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 1
WHERE provider_id = 'a2000000-0000-0000-0000-000000000008';


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  10. CLIENT COMMENTS ON POSTS (approved, visible in feed)                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Spread comments across old + new posts with varied engagement

INSERT INTO comments (id, status_update_id, user_id, body, is_approved, moderated_at, created_at)
VALUES
  -- Comments on maya.montreal's posts (from migration 044)
  ('cc100000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Stunning as always! 😍', true, now(), now() - interval '1 hour 30 minutes'),
  ('cc100000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Montreal is lucky to have you', true, now(), now() - interval '1 hour 15 minutes'),
  ('cc100000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000004',
   'Those photos are fire 🔥', true, now(), now() - interval '5 hours'),

  -- Comments on nina.montreal's posts
  ('cc100000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
   'Toqué is amazing! Lucky dinner date', true, now(), now() - interval '2 hours 30 minutes'),
  ('cc100000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005',
   'Save me a seat 🍷', true, now(), now() - interval '2 hours'),

  -- Comments on luna.montreal's posts (new)
  ('cc100000-0000-0000-0000-000000000006', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003',
   'Griffintown vibes are unmatched', true, now(), now() - interval '45 minutes'),
  ('cc100000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004',
   'What a view! 🌃', true, now(), now() - interval '30 minutes'),
  ('cc100000-0000-0000-0000-000000000008', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'Night owl gang 🦉', true, now(), now() - interval '20 minutes'),
  ('cc100000-0000-0000-0000-000000000009', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000005',
   'Wow that set is gorgeous', true, now(), now() - interval '8 hours'),
  ('cc100000-0000-0000-0000-000000000010', 'e1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001',
   'Instant follow 😍', true, now(), now() - interval '7 hours'),

  -- Comments on aria.montreal's posts
  ('cc100000-0000-0000-0000-000000000011', 'e1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000001',
   'Model material for real 👏', true, now(), now() - interval '1 hour 40 minutes'),
  ('cc100000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000003',
   'Where was this shoot?', true, now(), now() - interval '1 hour 20 minutes'),
  ('cc100000-0000-0000-0000-000000000013', 'e1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000004',
   'Absolutely stunning', true, now(), now() - interval '1 hour'),
  ('cc100000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000005', 'c1000000-0000-0000-0000-000000000005',
   'Weekend booking sent! 🙌', true, now(), now() - interval '10 hours'),

  -- Comments on violet.montreal's posts
  ('cc100000-0000-0000-0000-000000000015', 'e1000000-0000-0000-0000-000000000007', 'c1000000-0000-0000-0000-000000000004',
   'Intriguing... 👀', true, now(), now() - interval '2 hours 30 minutes'),
  ('cc100000-0000-0000-0000-000000000016', 'e1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000003',
   'Tempting caption 😈', true, now(), now() - interval '14 hours'),

  -- Comments on ivy.montreal's posts
  ('cc100000-0000-0000-0000-000000000017', 'e1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000001',
   'This is why you''re the best 🔥', true, now(), now() - interval '4 hours'),
  ('cc100000-0000-0000-0000-000000000018', 'e1000000-0000-0000-0000-000000000012', 'c1000000-0000-0000-0000-000000000005',
   'Booked and ready!', true, now(), now() - interval '3 hours 30 minutes'),
  ('cc100000-0000-0000-0000-000000000019', 'e1000000-0000-0000-0000-000000000013', 'c1000000-0000-0000-0000-000000000003',
   'Repeat client discount is smart 💯', true, now(), now() - interval '13 hours'),

  -- Comments on bella.montreal's posts
  ('cc100000-0000-0000-0000-000000000020', 'e1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000004',
   'Italian food AND Italian beauty? Sign me up 🇮🇹', true, now(), now() - interval '5 hours'),
  ('cc100000-0000-0000-0000-000000000021', 'e1000000-0000-0000-0000-000000000014', 'c1000000-0000-0000-0000-000000000001',
   'Best dinner date in MTL', true, now(), now() - interval '4 hours 30 minutes'),

  -- Comments on emma.quebec's posts (from migration 044)
  ('cc100000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000002',
   'QC represent! Beautiful shot 🏰', true, now(), now() - interval '45 minutes'),
  ('cc100000-0000-0000-0000-000000000023', 'c1000000-0000-0000-0000-000000000011', 'c1000000-0000-0000-0000-000000000002',
   'Me and my wife are interested 👀', true, now(), now() - interval '7 hours'),

  -- Comments on rose.quebec's posts
  ('cc100000-0000-0000-0000-000000000024', 'e1000000-0000-0000-0000-000000000017', 'c1000000-0000-0000-0000-000000000002',
   'Class and beauty, rare combo', true, now(), now() - interval '2 hours'),

  -- Comments on lily.quebec's posts
  ('cc100000-0000-0000-0000-000000000025', 'e1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000002',
   'Bringing the snacks for sure 🍕', true, now(), now() - interval '1 hour 30 minutes'),
  ('cc100000-0000-0000-0000-000000000026', 'e1000000-0000-0000-0000-000000000019', 'c1000000-0000-0000-0000-000000000005',
   '420 friendly is a must 🍃', true, now(), now() - interval '1 hour'),

  -- Comments on sofia.montreal's posts (from migration 044)
  ('cc100000-0000-0000-0000-000000000027', 'c1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000004',
   'Paris AND Montreal? Living the dream', true, now(), now() - interval '4 hours'),
  ('cc100000-0000-0000-0000-000000000028', 'c1000000-0000-0000-0000-000000000008', 'c1000000-0000-0000-0000-000000000001',
   'Weekend getaway sounds perfect ✈️', true, now(), now() - interval '3 hours 30 minutes')
ON CONFLICT (id) DO NOTHING;

-- Update comments_count on posts that received comments
-- (The trigger normally handles this but since we're bulk inserting, let's sync)
UPDATE status_updates su SET comments_count = (
  SELECT COUNT(*) FROM comments c
  WHERE c.status_update_id = su.id AND c.is_approved = true
)
WHERE su.id IN (
  'c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002',
  'c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000008',
  'c1000000-0000-0000-0000-000000000010', 'c1000000-0000-0000-0000-000000000011',
  'e1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002',
  'e1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000005',
  'e1000000-0000-0000-0000-000000000007', 'e1000000-0000-0000-0000-000000000008',
  'e1000000-0000-0000-0000-000000000012', 'e1000000-0000-0000-0000-000000000013',
  'e1000000-0000-0000-0000-000000000014', 'e1000000-0000-0000-0000-000000000017',
  'e1000000-0000-0000-0000-000000000019'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  11. LIKES FROM CLIENTS (varied engagement)                              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO likes (user_id, status_update_id, created_at)
VALUES
  -- alex_mtl likes
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', now() - interval '50 minutes'),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000002', now() - interval '8 hours'),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000004', now() - interval '1 hour 45 minutes'),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000012', now() - interval '4 hours 15 minutes'),
  ('c1000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000014', now() - interval '5 hours'),
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', now() - interval '1 hour 35 minutes'),

  -- marcus_qc likes
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000017', now() - interval '2 hours 15 minutes'),
  ('c1000000-0000-0000-0000-000000000002', 'e1000000-0000-0000-0000-000000000019', now() - interval '1 hour 40 minutes'),
  ('c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000010', now() - interval '50 minutes'),
  ('c1000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000011', now() - interval '7 hours 30 minutes'),

  -- david_514 likes
  ('c1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000001', now() - interval '40 minutes'),
  ('c1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000004', now() - interval '1 hour 25 minutes'),
  ('c1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000007', now() - interval '2 hours 40 minutes'),
  ('c1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000008', now() - interval '14 hours 15 minutes'),
  ('c1000000-0000-0000-0000-000000000003', 'e1000000-0000-0000-0000-000000000013', now() - interval '13 hours 20 minutes'),

  -- james_vip likes
  ('c1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000001', now() - interval '35 minutes'),
  ('c1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000002', now() - interval '7 hours 20 minutes'),
  ('c1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000004', now() - interval '1 hour 10 minutes'),
  ('c1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000005', now() - interval '10 hours 30 minutes'),
  ('c1000000-0000-0000-0000-000000000004', 'e1000000-0000-0000-0000-000000000012', now() - interval '4 hours 30 minutes'),
  ('c1000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000008', now() - interval '4 hours 20 minutes'),

  -- ryan_mtl likes
  ('c1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000002', now() - interval '8 hours 15 minutes'),
  ('c1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000005', now() - interval '10 hours 15 minutes'),
  ('c1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000012', now() - interval '3 hours 45 minutes'),
  ('c1000000-0000-0000-0000-000000000005', 'e1000000-0000-0000-0000-000000000019', now() - interval '1 hour 10 minutes')
ON CONFLICT DO NOTHING;

-- Sync likes_count after the trigger has added the seeded likes
-- (the seeded likes_count baseline + actual like rows can drift, so resync)
UPDATE status_updates su SET likes_count = GREATEST(
  su.likes_count,
  (SELECT COUNT(*) FROM likes l WHERE l.status_update_id = su.id)
)
WHERE su.id::text LIKE 'e1000000%' OR su.id::text LIKE 'c1000000%';
