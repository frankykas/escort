-- ============================================================================
-- Migration 055: Fresh seed data — realistic multi-city population
-- ============================================================================
-- Refreshes expired listings/bumps + adds new providers across 5 cities,
-- multiple listings per provider, active bumps at all tiers, message requests,
-- accepted chats, follows, and likes.
-- ============================================================================


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  0. REFRESH ALL EXISTING LISTINGS & BUMPS (un-expire them)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

UPDATE listings
SET expires_at = now() + interval '7 days'
WHERE expires_at < now();

UPDATE listing_bumps
SET expires_at = now() + interval '24 hours',
    bumped_at = now(),
    is_active = true
WHERE expires_at < now();


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. NEW PROVIDERS — Toronto (4), Vancouver (3), Ottawa (2)              ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  -- Toronto
  ('a3000000-0000-0000-0000-000000000001', 'diamond.toronto@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"diamond.to"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000002', 'savannah.toronto@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"savannah.to"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000003', 'amber.toronto@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"amber.to"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000004', 'jasmine.toronto@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"jasmine.to"}', now(), now(), '', 'authenticated', 'authenticated'),
  -- Vancouver
  ('a3000000-0000-0000-0000-000000000005', 'crystal.vancouver@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"crystal.van"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000006', 'mia.vancouver@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"mia.van"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000007', 'serena.vancouver@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"serena.van"}', now(), now(), '', 'authenticated', 'authenticated'),
  -- Ottawa
  ('a3000000-0000-0000-0000-000000000008', 'natasha.ottawa@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"natasha.ott"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a3000000-0000-0000-0000-000000000009', 'vivienne.ottawa@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"vivienne.ott"}', now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. NEW PROVIDER PROFILES                                                ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, tagline, onboarding_completed, post_credits_balance)
VALUES
  -- Toronto
  ('a3000000-0000-0000-0000-000000000001', 'diamond.to',
   'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop',
   'Top-rated companion in downtown Toronto. VIP treatment guaranteed.',
   true, 'verified', 'Toronto', 'CA', 27,
   'Nothing but the best', true, 20),

  ('a3000000-0000-0000-0000-000000000002', 'savannah.to',
   'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=400&h=400&fit=crop',
   'Southern charm, northern beauty. Available for dinner dates and private encounters in the GTA.',
   true, 'verified', 'Toronto', 'CA', 25,
   'Sweet as honey', true, 20),

  ('a3000000-0000-0000-0000-000000000003', 'amber.to',
   'https://images.unsplash.com/photo-1514315384763-ba401779410f?w=400&h=400&fit=crop',
   'Fitness model and part-time companion. Athletic build, endless stamina.',
   true, 'none', 'Toronto', 'CA', 24,
   'Fit body, free spirit', true, 20),

  ('a3000000-0000-0000-0000-000000000004', 'jasmine.to',
   'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?w=400&h=400&fit=crop',
   'Exotic beauty offering GFE and fetish-friendly sessions. Open-minded and adventurous.',
   true, 'verified', 'Toronto', 'CA', 28,
   'Dare to explore', true, 20),

  -- Vancouver
  ('a3000000-0000-0000-0000-000000000005', 'crystal.van',
   'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=400&fit=crop',
   'West coast vibes. Yoga instructor by day, elite companion by night.',
   true, 'verified', 'Vancouver', 'CA', 26,
   'Namaste in the sheets', true, 20),

  ('a3000000-0000-0000-0000-000000000006', 'mia.van',
   'https://images.unsplash.com/photo-1504730030853-eff311f57d3c?w=400&h=400&fit=crop',
   'Half Japanese, half French. Bilingual, cultured, and effortlessly sexy.',
   true, 'verified', 'Vancouver', 'CA', 23,
   'East meets West', true, 20),

  ('a3000000-0000-0000-0000-000000000007', 'serena.van',
   'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=400&h=400&fit=crop',
   'Mature, sophisticated, and incredibly sensual. 10 years experience.',
   true, 'none', 'Vancouver', 'CA', 34,
   'Age is just a number', true, 20),

  -- Ottawa
  ('a3000000-0000-0000-0000-000000000008', 'natasha.ott',
   'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=400&fit=crop',
   'Russian-born, Canadian raised. Speaks 4 languages. Perfect for diplomatic events.',
   true, 'verified', 'Ottawa', 'CA', 29,
   'Worldly and wonderful', true, 20),

  ('a3000000-0000-0000-0000-000000000009', 'vivienne.ott',
   'https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=400&h=400&fit=crop',
   'Redhead with a wild side. Fetish-friendly and BDSM curious.',
   true, 'none', 'Ottawa', 'CA', 26,
   'Fiery in every way', true, 20)
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
-- ║  3. NEW CLIENT ACCOUNTS — multi-city                                     ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  ('c2000000-0000-0000-0000-000000000001', 'mike.toronto@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"mike_to"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c2000000-0000-0000-0000-000000000002', 'kevin.vancouver@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"kevin_van"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('c2000000-0000-0000-0000-000000000003', 'steve.ottawa@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"steve_ott"}', now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, onboarding_completed)
VALUES
  ('c2000000-0000-0000-0000-000000000001', 'mike_to',
   'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Toronto', 'CA', 38, true),
  ('c2000000-0000-0000-0000-000000000002', 'kevin_van',
   'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Vancouver', 'CA', 33, true),
  ('c2000000-0000-0000-0000-000000000003', 'steve_ott',
   'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop',
   NULL, false, 'none', 'Ottawa', 'CA', 45, true)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  avatar_url = EXCLUDED.avatar_url,
  is_provider = EXCLUDED.is_provider,
  city = EXCLUDED.city,
  country_code = EXCLUDED.country_code,
  age = EXCLUDED.age,
  onboarding_completed = EXCLUDED.onboarding_completed;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. LISTINGS — 2-3 per new provider (27 total)                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (id, provider_id, title, description, rate, duration_minutes, service_type, perks, is_active, expires_at, created_at)
VALUES
  -- diamond.to (3 listings)
  ('b3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
   'VIP Diamond Experience', 'The ultimate Toronto companion experience. Luxury condo in Yorkville. Wine, conversation, and unforgettable chemistry.',
   50000, 120, 'GFE', ARRAY['Yorkville condo', 'Wine included', 'Overnight available', 'VIP only'], true, now() + interval '7 days', now() - interval '1 hour'),

  ('b3000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000001',
   'Quick Connect', 'Short and sweet. Perfect for your lunch break or a quick escape.',
   25000, 30, 'Companionship', ARRAY['30 min special', 'Downtown Toronto', 'Discreet'], true, now() + interval '7 days', now() - interval '3 hours'),

  ('b3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000001',
   'Dinner at Canoe', 'Join me for dinner at one of Toronto''s finest restaurants. Full evening package.',
   65000, 180, 'Dinner Date', ARRAY['Fine dining', 'Evening dress', 'Downtown', 'Full evening'], true, now() + interval '7 days', now() - interval '5 hours'),

  -- savannah.to (2 listings)
  ('b3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000002',
   'Southern Comfort', 'Warm, genuine connection. I''ll make you feel right at home. Incall at my midtown apartment.',
   30000, 60, 'GFE', ARRAY['Incall only', 'Midtown', 'No rush', 'Warm & genuine'], true, now() + interval '7 days', now() - interval '2 hours'),

  ('b3000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000002',
   'Weekend Getaway', 'Take me out of the city. Niagara, Muskoka, or surprise me.',
   80000, NULL, 'Travel', ARRAY['Weekend trips', 'Passport ready', 'Flexible schedule', 'Adventure lover'], true, now() + interval '7 days', now() - interval '4 hours'),

  -- amber.to (2 listings)
  ('b3000000-0000-0000-0000-000000000006', 'a3000000-0000-0000-0000-000000000003',
   'Fitness Date', 'Work out together, shower together, enjoy together. My home gym or yours.',
   28000, 90, 'Companionship', ARRAY['Home gym', 'Athletic', 'Post-workout massage', 'Outcall available'], true, now() + interval '7 days', now() - interval '6 hours'),

  ('b3000000-0000-0000-0000-000000000007', 'a3000000-0000-0000-0000-000000000003',
   'Sensual Massage', 'Deep tissue meets sensual. Certified and experienced. Oil included.',
   22000, 60, 'Massage', ARRAY['Deep tissue', 'Sensual', 'Oil included', 'Liberty Village'], true, now() + interval '7 days', now() - interval '8 hours'),

  -- jasmine.to (3 listings)
  ('b3000000-0000-0000-0000-000000000008', 'a3000000-0000-0000-0000-000000000004',
   'Exotic GFE', 'Passionate, uninhibited, and genuinely connected. No clock-watching.',
   38000, 60, 'GFE', ARRAY['No clock-watching', 'Downtown TO', 'Shower together', 'Repeat discount'], true, now() + interval '7 days', now() - interval '30 minutes'),

  ('b3000000-0000-0000-0000-000000000009', 'a3000000-0000-0000-0000-000000000004',
   'Fetish Exploration', 'Safe, sane, and consensual. Beginners especially welcome. Let''s explore your fantasies.',
   35000, 90, 'Fetish', ARRAY['Beginners welcome', 'Custom sessions', 'Safe word protocol', 'Roleplay'], true, now() + interval '7 days', now() - interval '7 hours'),

  ('b3000000-0000-0000-0000-000000000010', 'a3000000-0000-0000-0000-000000000004',
   'PSE Unleashed', 'The adult film experience in real life. No limits, no judgment.',
   42000, 60, 'PSE', ARRAY['Full PSE', 'No limits', 'Incall & outcall', 'DFK included'], true, now() + interval '7 days', now() - interval '10 hours'),

  -- crystal.van (2 listings)
  ('b3000000-0000-0000-0000-000000000011', 'a3000000-0000-0000-0000-000000000005',
   'Zen & Sensual', 'Start with yoga, end with bliss. My Kitsilano studio is your sanctuary.',
   32000, 120, 'Tantric', ARRAY['Yoga session', 'Tantric massage', 'Kitsilano studio', 'Organic oils'], true, now() + interval '7 days', now() - interval '45 minutes'),

  ('b3000000-0000-0000-0000-000000000012', 'a3000000-0000-0000-0000-000000000005',
   'Sunset Beach Walk', 'Casual, relaxed companion for a beach walk + whatever comes next.',
   25000, 90, 'Companionship', ARRAY['Beach walks', 'Casual vibe', '420-friendly', 'West End'], true, now() + interval '7 days', now() - interval '3 hours'),

  -- mia.van (3 listings)
  ('b3000000-0000-0000-0000-000000000013', 'a3000000-0000-0000-0000-000000000006',
   'East Meets West', 'Bilingual FR/EN, culturally fluent. Perfect arm candy for any event.',
   35000, 120, 'Dinner Date', ARRAY['Bilingual', 'Events', 'Gastown', 'Cultured conversation'], true, now() + interval '7 days', now() - interval '2 hours'),

  ('b3000000-0000-0000-0000-000000000014', 'a3000000-0000-0000-0000-000000000006',
   'Private Encounter', 'Intimate and passionate. My Yaletown condo or your hotel.',
   30000, 60, 'GFE', ARRAY['Incall & outcall', 'Yaletown', 'Discreet entrance', 'No rush'], true, now() + interval '7 days', now() - interval '5 hours'),

  ('b3000000-0000-0000-0000-000000000015', 'a3000000-0000-0000-0000-000000000006',
   'Couples Welcome', 'Experienced and comfortable with couples. Your fantasy, my pleasure.',
   45000, 120, 'Couples', ARRAY['Couples expert', 'No judgment', 'Hotels preferred', 'Advance booking'], true, now() + interval '7 days', now() - interval '9 hours'),

  -- serena.van (2 listings)
  ('b3000000-0000-0000-0000-000000000016', 'a3000000-0000-0000-0000-000000000007',
   'Mature Seduction', 'Experience counts. I know exactly what you need before you do.',
   28000, 60, 'GFE', ARRAY['Experienced', 'No drama', 'Outcall only', 'Hotels & residences'], true, now() + interval '7 days', now() - interval '4 hours'),

  ('b3000000-0000-0000-0000-000000000017', 'a3000000-0000-0000-0000-000000000007',
   'Domination Lite', 'Light BDSM for the curious. Teasing, denial, and power play. Safe and fun.',
   32000, 90, 'Domination', ARRAY['Light BDSM', 'Beginners OK', 'Power play', 'Safe & fun'], true, now() + interval '7 days', now() - interval '11 hours'),

  -- natasha.ott (2 listings)
  ('b3000000-0000-0000-0000-000000000018', 'a3000000-0000-0000-0000-000000000008',
   'Diplomatic Companion', 'Perfect for embassy events, galas, and private dinners. Multilingual.',
   45000, 180, 'Dinner Date', ARRAY['Multilingual', 'Events & galas', 'ByWard Market', 'Elegant attire'], true, now() + interval '7 days', now() - interval '1 hour'),

  ('b3000000-0000-0000-0000-000000000019', 'a3000000-0000-0000-0000-000000000008',
   'Private Russian GFE', 'Authentic warmth and passion. Incall at my Centretown apartment.',
   35000, 60, 'GFE', ARRAY['Russian beauty', 'Incall', 'Centretown', 'Genuine connection'], true, now() + interval '7 days', now() - interval '6 hours'),

  -- vivienne.ott (2 listings)
  ('b3000000-0000-0000-0000-000000000020', 'a3000000-0000-0000-0000-000000000009',
   'Firestarter', 'Redhead, wild energy, unforgettable night. Fetish-friendly and open-minded.',
   28000, 60, 'Fetish', ARRAY['Redhead', 'Fetish-friendly', 'Roleplay', 'Glebe area'], true, now() + interval '7 days', now() - interval '2 hours'),

  ('b3000000-0000-0000-0000-000000000021', 'a3000000-0000-0000-0000-000000000009',
   'BDSM Curious', 'Let me introduce you to the world of kink. Gentle, patient, and creative.',
   30000, 90, 'BDSM', ARRAY['Intro to BDSM', 'Patient guide', 'Custom scenarios', 'Safe word'], true, now() + interval '7 days', now() - interval '8 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. CREDIT PURCHASES (so bumps can be created)                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO posting_package_purchases (provider_id, credits_purchased, credits_remaining, purchased_at, expires_at)
VALUES
  ('a3000000-0000-0000-0000-000000000001', 20, 17, now(), NULL),
  ('a3000000-0000-0000-0000-000000000002', 20, 18, now(), NULL),
  ('a3000000-0000-0000-0000-000000000003', 20, 20, now(), NULL),
  ('a3000000-0000-0000-0000-000000000004', 20, 17, now(), NULL),
  ('a3000000-0000-0000-0000-000000000005', 20, 17, now(), NULL),
  ('a3000000-0000-0000-0000-000000000006', 20, 19, now(), NULL),
  ('a3000000-0000-0000-0000-000000000007', 20, 20, now(), NULL),
  ('a3000000-0000-0000-0000-000000000008', 20, 17, now(), NULL),
  ('a3000000-0000-0000-0000-000000000009', 20, 20, now(), NULL);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. ACTIVE BUMPS — spread across tiers and cities                        ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Tier 3 (VIP): diamond.to, jasmine.to, crystal.van, natasha.ott
-- Tier 2 (PRO): savannah.to, mia.van
-- Tier 1 (HOT): (none new — nina.montreal & jade.montreal from old seed still active)

INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, bumped_at, expires_at, is_active)
VALUES
  -- Toronto — VIP bumps
  ('b3000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001',
   3, 3, now(), now() + interval '24 hours', true),

  ('b3000000-0000-0000-0000-000000000008', 'a3000000-0000-0000-0000-000000000004',
   3, 3, now(), now() + interval '24 hours', true),

  -- Toronto — PRO bump
  ('b3000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000002',
   2, 2, now(), now() + interval '24 hours', true),

  -- Vancouver — VIP bump
  ('b3000000-0000-0000-0000-000000000011', 'a3000000-0000-0000-0000-000000000005',
   3, 3, now(), now() + interval '24 hours', true),

  -- Vancouver — PRO bump
  ('b3000000-0000-0000-0000-000000000013', 'a3000000-0000-0000-0000-000000000006',
   1, 1, now(), now() + interval '24 hours', true),

  -- Ottawa — VIP bump
  ('b3000000-0000-0000-0000-000000000018', 'a3000000-0000-0000-0000-000000000008',
   3, 3, now(), now() + interval '24 hours', true)
ON CONFLICT DO NOTHING;

-- Deduct credits from profiles for bumps
UPDATE profiles SET post_credits_balance = 17 WHERE id = 'a3000000-0000-0000-0000-000000000001'; -- 20 - 3
UPDATE profiles SET post_credits_balance = 18 WHERE id = 'a3000000-0000-0000-0000-000000000002'; -- 20 - 2
UPDATE profiles SET post_credits_balance = 17 WHERE id = 'a3000000-0000-0000-0000-000000000004'; -- 20 - 3
UPDATE profiles SET post_credits_balance = 17 WHERE id = 'a3000000-0000-0000-0000-000000000005'; -- 20 - 3
UPDATE profiles SET post_credits_balance = 19 WHERE id = 'a3000000-0000-0000-0000-000000000006'; -- 20 - 1
UPDATE profiles SET post_credits_balance = 17 WHERE id = 'a3000000-0000-0000-0000-000000000008'; -- 20 - 3


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. MESSAGE REQUESTS & ACCEPTED CHATS                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Simulate real interactions: some pending, some accepted with chat channels.

-- Accepted: mike_to → diamond.to
INSERT INTO message_requests (sender_id, recipient_id, intro_message, status, channel_id, created_at, updated_at)
VALUES (
  'c2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'Hey Diamond, I saw your VIP listing. I''d love to book for Friday evening. Are you available?',
  'accepted',
  (SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
  now() - interval '2 hours',
  now() - interval '1 hour'
)
ON CONFLICT DO NOTHING;

-- Create the chat channel + members for accepted request
INSERT INTO chat_channels (id, created_by, created_at)
VALUES (
  (SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
  'a3000000-0000-0000-0000-000000000001',
  now() - interval '1 hour'
)
ON CONFLICT DO NOTHING;

INSERT INTO chat_channel_members (channel_id, user_id)
VALUES
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'c2000000-0000-0000-0000-000000000001'),
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'a3000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Chat messages in the accepted channel
INSERT INTO chat_messages (channel_id, sender_id, text, created_at)
VALUES
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'c2000000-0000-0000-0000-000000000001',
   'Hey Diamond, I saw your VIP listing. I''d love to book for Friday evening. Are you available?',
   now() - interval '55 minutes'),
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'a3000000-0000-0000-0000-000000000001',
   'Hi Mike! Yes, Friday works perfectly. I have availability from 7pm onwards. Would you prefer my Yorkville condo or your hotel?',
   now() - interval '50 minutes'),
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'c2000000-0000-0000-0000-000000000001',
   'Your place sounds great. 8pm work? I''ll bring wine.',
   now() - interval '45 minutes'),
  ((SELECT concat(LEAST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')), GREATEST(replace('c2000000-0000-0000-0000-000000000001'::text,'-',''), replace('a3000000-0000-0000-0000-000000000001'::text,'-','')))),
   'a3000000-0000-0000-0000-000000000001',
   'Perfect! 8pm it is. Red wine preferred. See you then!',
   now() - interval '40 minutes');

-- Pending: kevin_van → crystal.van
INSERT INTO message_requests (sender_id, recipient_id, intro_message, status, created_at, updated_at)
VALUES (
  'c2000000-0000-0000-0000-000000000002',
  'a3000000-0000-0000-0000-000000000005',
  'Hi Crystal, your Zen & Sensual listing looks amazing. Do you have availability this weekend?',
  'pending',
  now() - interval '30 minutes',
  now() - interval '30 minutes'
)
ON CONFLICT DO NOTHING;

-- Pending: steve_ott → natasha.ott
INSERT INTO message_requests (sender_id, recipient_id, intro_message, status, created_at, updated_at)
VALUES (
  'c2000000-0000-0000-0000-000000000003',
  'a3000000-0000-0000-0000-000000000008',
  'Natasha, I have a diplomatic event next Thursday. Would love to discuss details.',
  'pending',
  now() - interval '15 minutes',
  now() - interval '15 minutes'
)
ON CONFLICT DO NOTHING;

-- Pending: alex_mtl → maya.montreal (existing client → existing provider)
INSERT INTO message_requests (sender_id, recipient_id, intro_message, status, created_at, updated_at)
VALUES (
  'c1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'Hey Maya, are you available tonight for the GFE? I''m in downtown Montreal.',
  'pending',
  now() - interval '10 minutes',
  now() - interval '10 minutes'
)
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  8. FOLLOWS — clients following their favorite providers                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO follows (follower_id, following_id)
VALUES
  ('c2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000002'),
  ('c2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000004'),
  ('c2000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000005'),
  ('c2000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000006'),
  ('c2000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000008'),
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000005'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002'),
  ('c1000000-0000-0000-0000-000000000004', 'a3000000-0000-0000-0000-000000000001'),
  ('c1000000-0000-0000-0000-000000000005', 'a3000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  9. NOTIFICATIONS — so providers see activity                            ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_id, reference_type)
VALUES
  ('a3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001',
   'message_request', 'New message request', '@mike_to wants to chat', 'c2000000-0000-0000-0000-000000000001', 'message_request'),
  ('a3000000-0000-0000-0000-000000000005', 'c2000000-0000-0000-0000-000000000002',
   'message_request', 'New message request', '@kevin_van wants to chat: Hi Crystal, your Zen & Sensual listing looks amazing...', 'c2000000-0000-0000-0000-000000000002', 'message_request'),
  ('a3000000-0000-0000-0000-000000000008', 'c2000000-0000-0000-0000-000000000003',
   'message_request', 'New message request', '@steve_ott wants to chat: Natasha, I have a diplomatic event next Thursday...', 'c2000000-0000-0000-0000-000000000003', 'message_request'),
  ('a1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001',
   'message_request', 'New message request', '@alex_mtl wants to chat: Hey Maya, are you available tonight...', 'c1000000-0000-0000-0000-000000000001', 'message_request'),
  ('a3000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000004',
   'new_follower', 'New follower', '@james_vip started following you', 'c1000000-0000-0000-0000-000000000004', 'profile'),
  ('a3000000-0000-0000-0000-000000000004', 'c1000000-0000-0000-0000-000000000005',
   'new_follower', 'New follower', '@ryan_mtl started following you', 'c1000000-0000-0000-0000-000000000005', 'profile')
ON CONFLICT DO NOTHING;
