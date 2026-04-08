-- ============================================================================
-- Migration 044: Seed data for bump system testing
-- ============================================================================
-- Creates 6 providers across Montreal + Quebec City with listings, posts,
-- stories, credits, and bumps at different tiers.
-- ============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  1. CREATE AUTH USERS                                                    ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, aud, role)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'maya.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"maya.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000002', 'nina.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"nina.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000003', 'jade.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"jade.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000004', 'sofia.montreal@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"sofia.montreal"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000005', 'emma.quebec@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"emma.quebec"}', now(), now(), '', 'authenticated', 'authenticated'),
  ('a1000000-0000-0000-0000-000000000006', 'chloe.quebec@cleopatra.seed', crypt('seed_password_never_used_123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"username":"chloe.quebec"}', now(), now(), '', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  2. CREATE PROFILES                                                      ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO profiles (id, username, avatar_url, bio, is_provider, verification_status, city, country_code, age, tagline, onboarding_completed, post_credits_balance)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 'maya.montreal',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
   'Premium companion in the heart of Montreal. Sophistication meets warmth.',
   true, 'verified', 'Montreal', 'CA', 26,
   'Where elegance meets desire ✨', true, 10),

  ('a1000000-0000-0000-0000-000000000002', 'nina.montreal',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop',
   'Your perfect dinner date. Cultured, charming, unforgettable evenings.',
   true, 'verified', 'Montreal', 'CA', 24,
   'Fine dining & finer company', true, 10),

  ('a1000000-0000-0000-0000-000000000003', 'jade.montreal',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
   'Certified massage therapist. Deep tissue, Swedish, and sensual relaxation.',
   true, 'none', 'Montreal', 'CA', 28,
   'Healing hands, peaceful mind', true, 10),

  ('a1000000-0000-0000-0000-000000000004', 'sofia.montreal',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
   'Jet-setter available for travel companionship. Multilingual, well-traveled.',
   true, 'verified', 'Montreal', 'CA', 30,
   'Adventure awaits', true, 10),

  ('a1000000-0000-0000-0000-000000000005', 'emma.quebec',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop',
   'Couples-friendly companion in Quebec City. Discreet and open-minded.',
   true, 'verified', 'Quebec City', 'CA', 27,
   'Twice the fun 💫', true, 10),

  ('a1000000-0000-0000-0000-000000000006', 'chloe.quebec',
   'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop',
   'New to Quebec City. GFE specialist, warm personality, great conversation.',
   true, 'none', 'Quebec City', 'CA', 23,
   'Your girl next door', true, 10)
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
-- ║  3. CREATE LISTINGS (first listing = free for each provider)             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO listings (id, provider_id, title, description, rate, duration_minutes, service_type, perks, is_active, expires_at)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'GFE – The Full Experience',
   'An unforgettable girlfriend experience. Passionate, attentive, and genuinely connected. Incall at my luxury downtown condo or outcall to your hotel.',
   30000, 60, 'GFE',
   ARRAY['Incall & outcall', 'Downtown Montreal', 'Discreet & private', 'Overnight available'],
   true, now() + interval '24 hours'),

  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'Dinner Date Companion',
   'The perfect plus-one for any occasion. Engaging conversation, impeccable style, and a night you won''t forget.',
   25000, 120, 'Dinner Date',
   ARRAY['Fine dining', 'Cocktail events', 'Bilingual EN/FR', 'Elegant attire'],
   true, now() + interval '24 hours'),

  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   'Relaxation Massage',
   'Professional deep tissue and Swedish massage. Certified therapist with 5 years experience. Private studio near Plateau.',
   18000, 90, 'Massage',
   ARRAY['Deep tissue', 'Swedish', 'Hot stones', 'Private studio'],
   true, now() + interval '24 hours'),

  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'Travel Companion',
   'Available for domestic and international travel. Passport-ready, multilingual (EN/FR/ES), experienced jet-setter.',
   40000, NULL, 'Travel',
   ARRAY['Passport ready', 'Multilingual', 'Weekend getaways', 'International trips'],
   true, now() + interval '24 hours'),

  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   'Couples Experience',
   'Open-minded and experienced with couples. Safe, fun, and judgement-free. Your comfort is my priority.',
   35000, 120, 'Couples',
   ARRAY['Couples welcome', 'Safe & discreet', 'Hotels only', 'Advance booking required'],
   true, now() + interval '24 hours'),

  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006',
   'GFE Deluxe',
   'Authentic connection and genuine warmth. I love what I do and it shows. New to the city and excited to meet you.',
   28000, 60, 'GFE',
   ARRAY['Incall only', 'Old Quebec area', 'No rush', 'First-timers welcome'],
   true, now() + interval '24 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  4. CREATE FEED POSTS (2-3 per provider)                                 ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, post_type, media_type, caption, media_url, country_code, likes_count, comments_count, views_count, expires_at, created_at)
VALUES
  -- maya.montreal posts
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'post', 'image', 'Ready for a beautiful evening in Montreal 🌙',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop',
   'CA', 42, 5, 180, '2099-01-01', now() - interval '2 hours'),

  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001',
   'post', 'image', 'New photos just dropped ✨ DM for bookings',
   'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=600&fit=crop',
   'CA', 67, 8, 312, '2099-01-01', now() - interval '6 hours'),

  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001',
   'post', 'image', 'Weekend availability open! Book your spot 💋',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&h=600&fit=crop',
   'CA', 31, 3, 145, '2099-01-01', now() - interval '18 hours'),

  -- nina.montreal posts
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002',
   'post', 'image', 'Dinner at Toqué! tonight. Who wants to join? 🍷',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=600&fit=crop',
   'CA', 28, 4, 156, '2099-01-01', now() - interval '3 hours'),

  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002',
   'post', 'image', 'Nothing beats a sunset walk in Old Montreal 🌅',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&h=600&fit=crop',
   'CA', 45, 6, 230, '2099-01-01', now() - interval '12 hours'),

  -- jade.montreal posts
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000003',
   'post', 'image', 'New hot stone setup arrived! Book your relaxation session 🪨',
   'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=600&fit=crop',
   'CA', 19, 2, 95, '2099-01-01', now() - interval '4 hours'),

  ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000003',
   'post', 'image', 'Self-care Sunday is every day at my studio 💆‍♀️',
   'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&h=600&fit=crop',
   'CA', 22, 1, 110, '2099-01-01', now() - interval '20 hours'),

  -- sofia.montreal posts
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000004',
   'post', 'image', 'Just landed back from Paris. Ready for local adventures 🗼',
   'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&h=600&fit=crop',
   'CA', 55, 7, 290, '2099-01-01', now() - interval '5 hours'),

  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000004',
   'post', 'image', 'Available for weekend getaways — let''s explore together ✈️',
   'https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=600&h=600&fit=crop',
   'CA', 38, 4, 175, '2099-01-01', now() - interval '14 hours'),

  -- emma.quebec posts
  ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000005',
   'post', 'image', 'Château Frontenac views never get old 🏰',
   'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=600&h=600&fit=crop',
   'CA', 34, 3, 160, '2099-01-01', now() - interval '1 hour'),

  ('c1000000-0000-0000-0000-000000000011', 'a1000000-0000-0000-0000-000000000005',
   'post', 'image', 'Open for new connections in QC. Couples especially welcome 💕',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&h=600&fit=crop',
   'CA', 41, 5, 205, '2099-01-01', now() - interval '8 hours'),

  -- chloe.quebec posts
  ('c1000000-0000-0000-0000-000000000012', 'a1000000-0000-0000-0000-000000000006',
   'post', 'image', 'Exploring the cobblestone streets of Old Quebec 🌸',
   'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&h=600&fit=crop',
   'CA', 15, 2, 78, '2099-01-01', now() - interval '7 hours'),

  ('c1000000-0000-0000-0000-000000000013', 'a1000000-0000-0000-0000-000000000006',
   'post', 'image', 'New in town and loving it! Available this week 💫',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=600&h=600&fit=crop',
   'CA', 12, 1, 62, '2099-01-01', now() - interval '16 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  5. CREATE STORIES (1 per provider, expire in 24h)                       ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO status_updates (id, provider_id, post_type, media_type, caption, media_url, country_code, expires_at, created_at)
VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'story', 'image', 'Available tonight 🌙',
   'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '30 minutes'),

  ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   'story', 'image', 'Getting ready for dinner 🍷',
   'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '1 hour'),

  ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   'story', 'image', 'Studio open today 💆',
   'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '2 hours'),

  ('d1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004',
   'story', 'image', 'Packing for the weekend ✈️',
   'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '3 hours'),

  ('d1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   'story', 'image', 'Quebec City nights 🏰',
   'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '45 minutes'),

  ('d1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000006',
   'story', 'image', 'Good morning QC ☀️',
   'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=700&fit=crop',
   'CA', now() + interval '24 hours', now() - interval '4 hours')
ON CONFLICT (id) DO NOTHING;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  6. GRANT CREDITS (10 each via virtual purchase)                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

INSERT INTO posting_package_purchases (provider_id, credits_purchased, credits_remaining, purchased_at, expires_at)
VALUES
  ('a1000000-0000-0000-0000-000000000001', 10, 10, now(), NULL),
  ('a1000000-0000-0000-0000-000000000002', 10, 10, now(), NULL),
  ('a1000000-0000-0000-0000-000000000003', 10, 10, now(), NULL),
  ('a1000000-0000-0000-0000-000000000004', 10, 10, now(), NULL),
  ('a1000000-0000-0000-0000-000000000005', 10, 10, now(), NULL),
  ('a1000000-0000-0000-0000-000000000006', 10, 10, now(), NULL);

-- Note: The trigger sync_post_credits_balance_on_purchase will automatically
-- add 10 to each profile's post_credits_balance. Combined with the 10 set
-- in the profiles INSERT, they'll have 20 total. Let's correct the profile
-- balance to account for this:
UPDATE profiles
SET post_credits_balance = 20
WHERE id IN (
  'a1000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000002',
  'a1000000-0000-0000-0000-000000000003',
  'a1000000-0000-0000-0000-000000000004',
  'a1000000-0000-0000-0000-000000000005',
  'a1000000-0000-0000-0000-000000000006'
);


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  7. CREATE BUMPS                                                         ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- maya.montreal  → Tier 3 (Stories + Similar Profiles + Feed) — 3 credits
-- nina.montreal  → Tier 1 (Stories only) — 1 credit
-- jade.montreal  → Tier 2 (Stories + Similar Profiles) — 2 credits
-- emma.quebec    → Tier 3 (Stories + Similar Profiles + Feed) — 3 credits

INSERT INTO listing_bumps (listing_id, provider_id, tier, credits_spent, bumped_at, expires_at, is_active)
VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   3, 3, now(), now() + interval '24 hours', true),

  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002',
   1, 1, now(), now() + interval '24 hours', true),

  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003',
   2, 2, now(), now() + interval '24 hours', true),

  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005',
   3, 3, now(), now() + interval '24 hours', true);

-- Deduct credits spent on bumps
UPDATE profiles SET post_credits_balance = post_credits_balance - 3
WHERE id = 'a1000000-0000-0000-0000-000000000001'; -- maya: 20 - 3 = 17

UPDATE profiles SET post_credits_balance = post_credits_balance - 1
WHERE id = 'a1000000-0000-0000-0000-000000000002'; -- nina: 20 - 1 = 19

UPDATE profiles SET post_credits_balance = post_credits_balance - 2
WHERE id = 'a1000000-0000-0000-0000-000000000003'; -- jade: 20 - 2 = 18

UPDATE profiles SET post_credits_balance = post_credits_balance - 3
WHERE id = 'a1000000-0000-0000-0000-000000000005'; -- emma: 20 - 3 = 17

-- Also deduct from purchase records
UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 3
WHERE provider_id = 'a1000000-0000-0000-0000-000000000001';

UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 1
WHERE provider_id = 'a1000000-0000-0000-0000-000000000002';

UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 2
WHERE provider_id = 'a1000000-0000-0000-0000-000000000003';

UPDATE posting_package_purchases SET credits_remaining = credits_remaining - 3
WHERE provider_id = 'a1000000-0000-0000-0000-000000000005';
