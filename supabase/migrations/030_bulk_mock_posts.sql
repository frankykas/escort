-- ============================================================================
-- Migration 030: Bulk mock posts & stories for testing infinite scroll
-- ============================================================================
-- Creates ~30 posts and a few stories spread across existing providers.
-- Uses stock Unsplash photos. Safe to re-run.
-- ============================================================================

DO $$
DECLARE
  v_ids uuid[];
  v_count int;
BEGIN
  -- Gather all provider IDs
  SELECT array_agg(id) INTO v_ids
  FROM profiles
  WHERE is_provider = true;

  v_count := coalesce(array_length(v_ids, 1), 0);

  IF v_count = 0 THEN
    RAISE NOTICE 'No providers found — skipping mock data';
    RETURN;
  END IF;

  -- ── Feed posts ──────────────────────────────────────────────────────────
  -- Distribute across providers round-robin, stagger created_at so they
  -- appear at different times for a realistic infinite-scroll experience.

  INSERT INTO status_updates (provider_id, caption, media_url, media_type, post_type, country_code, expires_at, created_at)
  VALUES
    (v_ids[1 % v_count + 1], 'Available tonight in downtown Toronto. DMs open.',
     'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '1 hour'),

    (v_ids[2 % v_count + 1], 'Weekend getaway vibes. Taking bookings for Saturday evening.',
     'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '2 hours'),

    (v_ids[3 % v_count + 1], 'New photos just dropped. What do you think?',
     'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '3 hours'),

    (v_ids[1 % v_count + 1], 'Morning coffee and sunshine. Starting the day right.',
     'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '5 hours'),

    (v_ids[2 % v_count + 1], 'Just finished a wonderful dinner date in Yorkville.',
     'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '7 hours'),

    (v_ids[3 % v_count + 1], 'Spa day done right. Treating myself before the weekend rush.',
     'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '9 hours'),

    (v_ids[1 % v_count + 1], 'Exploring Montreal this week. Limited availability — book early.',
     'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '12 hours'),

    (v_ids[2 % v_count + 1], 'Late night vibes. The city never sleeps and neither do I.',
     'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '14 hours'),

    (v_ids[3 % v_count + 1], 'New lingerie set. Feeling unstoppable today.',
     'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '18 hours'),

    (v_ids[1 % v_count + 1], 'Cocktails at sunset. Perfect way to end the week.',
     'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '1 day'),

    (v_ids[2 % v_count + 1], 'Road trip to Niagara Falls. Come along for the ride.',
     'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '1 day 4 hours'),

    (v_ids[3 % v_count + 1], 'Red dress kind of night. Available for dinner dates.',
     'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '1 day 8 hours'),

    (v_ids[1 % v_count + 1], 'Gym session done. Feeling strong and confident.',
     'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '1 day 12 hours'),

    (v_ids[2 % v_count + 1], 'Quiet evening in. Sometimes the best company is your own.',
     'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '2 days'),

    (v_ids[3 % v_count + 1], 'Beach day. The water was perfect today.',
     'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '2 days 6 hours'),

    (v_ids[1 % v_count + 1], 'Brunch at my favourite spot in King West.',
     'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '2 days 12 hours'),

    (v_ids[2 % v_count + 1], 'New hair, new energy. Ready for a fresh start.',
     'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '3 days'),

    (v_ids[3 % v_count + 1], 'Taking a day off to recharge. Back tomorrow.',
     'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '3 days 6 hours'),

    (v_ids[1 % v_count + 1], 'Piano bar night. Love the jazz scene in this city.',
     'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '3 days 12 hours'),

    (v_ids[2 % v_count + 1], 'Sunny afternoon walk through High Park.',
     'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '4 days'),

    (v_ids[3 % v_count + 1], 'Midweek treat. Sometimes you just need dessert first.',
     'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '4 days 8 hours'),

    (v_ids[1 % v_count + 1], 'Art gallery visit. Culture feeds the soul.',
     'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '5 days'),

    (v_ids[2 % v_count + 1], 'Rooftop views at sunset. This city is beautiful.',
     'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '5 days 6 hours'),

    (v_ids[3 % v_count + 1], 'Weekend plans? I have a few openings left.',
     'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '5 days 12 hours'),

    (v_ids[1 % v_count + 1], 'Morning yoga session. Balance is everything.',
     'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '6 days'),

    (v_ids[2 % v_count + 1], 'New booking system is live. Check out my profile.',
     'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '6 days 8 hours'),

    (v_ids[3 % v_count + 1], 'Throwback to last week in Vancouver. Miss the mountains.',
     'https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '7 days'),

    (v_ids[1 % v_count + 1], 'Date night outfit check. Ready for an amazing evening.',
     'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '7 days 6 hours'),

    (v_ids[2 % v_count + 1], 'Loving the spring weather. Perfect for outdoor adventures.',
     'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '8 days'),

    (v_ids[3 % v_count + 1], 'Just landed in Calgary. Available for the next 3 days.',
     'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
     'image', 'post', 'CA', '2099-01-01Z', now() - interval '8 days 12 hours')

  ON CONFLICT DO NOTHING;

  -- ── Stories (expire in 24h) ─────────────────────────────────────────────

  INSERT INTO status_updates (provider_id, caption, media_url, media_type, post_type, country_code, expires_at)
  VALUES
    (v_ids[1 % v_count + 1], 'Good morning Toronto! Available today.',
     'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
     'image', 'story', 'CA', now() + interval '20 hours'),

    (v_ids[2 % v_count + 1], 'Just woke up. Coffee first, then let''s chat.',
     'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
     'image', 'story', 'CA', now() + interval '18 hours'),

    (v_ids[3 % v_count + 1], 'On my way to a shoot. Sneak peek coming soon!',
     'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
     'image', 'story', 'CA', now() + interval '22 hours');

END;
$$;
