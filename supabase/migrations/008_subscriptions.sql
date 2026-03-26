-- =============================================================================
-- Cleopatra — Migration 008: Premium Content Foundation
-- Adds subscription tiers, active subscriptions, PPV unlocks,
-- and extends listings + status_updates for premium features.
-- =============================================================================


-- ── Extend listings ──────────────────────────────────────────────────────────

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS service_type  text,
  ADD COLUMN IF NOT EXISTS perks         text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_url     text;


-- ── Extend status_updates ────────────────────────────────────────────────────

ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS is_premium    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_price  integer;          -- pence; NULL = sub-only


-- ── Extend profiles ──────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscribers_count integer NOT NULL DEFAULT 0;


-- ── subscription_tiers ───────────────────────────────────────────────────────
-- Each provider configures one active tier (their monthly price + perks).

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id   uuid        NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  monthly_rate  integer     NOT NULL,          -- pence
  description   text,
  perks         text[]      NOT NULL DEFAULT '{}',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscription_tiers: public read active"
  ON subscription_tiers FOR SELECT USING (is_active = true);

CREATE POLICY "subscription_tiers: owner manage"
  ON subscription_tiers FOR ALL
  USING (provider_id = auth.uid())
  WITH CHECK (provider_id = auth.uid());


-- ── subscriptions ────────────────────────────────────────────────────────────
-- Tracks active subscriber → provider relationships.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id           uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id             uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier_id                 uuid        REFERENCES subscription_tiers(id),
  status                  text        NOT NULL DEFAULT 'active'
                                      CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  current_period_end      timestamptz,
  stripe_subscription_id  text,
  stripe_customer_id      text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, provider_id)
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions: read own"
  ON subscriptions FOR SELECT
  USING (subscriber_id = auth.uid() OR provider_id = auth.uid());

CREATE POLICY "subscriptions: subscriber insert"
  ON subscriptions FOR INSERT
  WITH CHECK (subscriber_id = auth.uid());

CREATE POLICY "subscriptions: subscriber update"
  ON subscriptions FOR UPDATE
  USING (subscriber_id = auth.uid());

CREATE INDEX IF NOT EXISTS subscriptions_provider_idx
  ON subscriptions (provider_id) WHERE status = 'active';


-- ── content_unlocks (PPV) ────────────────────────────────────────────────────
-- One-time purchases of individual premium posts or listings.

CREATE TABLE IF NOT EXISTS content_unlocks (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content_id                uuid        NOT NULL,
  content_type              text        NOT NULL CHECK (content_type IN ('post', 'listing')),
  stripe_payment_intent_id  text,
  amount_paid               integer,   -- pence
  unlocked_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, content_type)
);

ALTER TABLE content_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_unlocks: owner read"
  ON content_unlocks FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "content_unlocks: owner insert"
  ON content_unlocks FOR INSERT WITH CHECK (user_id = auth.uid());


-- ── Trigger: keep subscribers_count in sync ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_subscribers_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    UPDATE profiles SET subscribers_count = subscribers_count + 1 WHERE id = NEW.provider_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'active' AND OLD.status != 'active' THEN
      UPDATE profiles SET subscribers_count = subscribers_count + 1 WHERE id = NEW.provider_id;
    ELSIF NEW.status != 'active' AND OLD.status = 'active' THEN
      UPDATE profiles SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id = NEW.provider_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
    UPDATE profiles SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id = OLD.provider_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER on_subscription_change
  AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_subscribers_count();


-- =============================================================================
-- MOCK DATA — run this block to seed test listings for themarketco
-- =============================================================================

DO $$
DECLARE
  pid uuid;
BEGIN
  SELECT id INTO pid FROM profiles WHERE username = 'themarketco';
  IF pid IS NULL THEN RETURN; END IF;

  -- Update profile attributes so the About tab has content
  UPDATE profiles SET
    is_provider         = true,
    age                 = 26,
    city                = 'London',
    country_code        = 'GB',
    incall              = true,
    outcall             = true,
    hourly_rate         = 20000,
    service_categories  = ARRAY['GFE', 'Dinner Date', 'Companionship'],
    height_cm           = 168,
    build               = 'Slim',
    hair_color          = 'Brunette',
    eye_color           = 'Brown',
    nationality         = 'British',
    languages           = ARRAY['English', 'French'],
    bio                 = 'London based. Available for selected gentlemen.',
    bio_long            = 'I am a sophisticated and discreet companion based in Central London. Whether you are looking for a relaxed evening, a travel partner, or stimulating conversation over dinner, I aim to make every encounter memorable and comfortable for you.'
  WHERE id = pid;

  -- Insert listings (ignore if they already exist by title)
  INSERT INTO listings (provider_id, title, description, duration_minutes, rate, service_type, perks, is_active, sort_order)
  VALUES
    (pid,
     'GFE – The Full Experience',
     'The girlfriend experience is about connection, chemistry and genuine companionship. Expect warmth, attentiveness and a truly immersive time together.',
     60, 20000, 'GFE',
     ARRAY['Companionship & conversation', 'Dinner or drinks', 'Affectionate & attentive', 'Incall or outcall', 'Strictly discreet'],
     true, 0),

    (pid,
     'Dinner Date',
     'Arrive at your event with a charming, well-spoken companion by your side. I am comfortable in fine dining environments, corporate events and private gatherings.',
     180, 35000, 'Dinner Date',
     ARRAY['3 hour minimum', 'Fine dining ready', 'Corporate event suitable', 'Travel within London included', 'Optional overnight add-on'],
     true, 1),

    (pid,
     'Overnight Stay',
     'A full evening through to morning. Perfect for those who want to unwind completely, enjoy relaxed company and wake up refreshed. Incall only.',
     720, 80000, 'Companionship',
     ARRAY['Evening through to morning', 'Incall only', 'Champagne welcome', 'Breakfast together', 'Completely discreet'],
     true, 2),

    (pid,
     'Travel Companion',
     'Available to accompany you on domestic or international travel. I hold a valid passport and am available for trips from a weekend to two weeks.',
     1440, 120000, 'Travel',
     ARRAY['Passport ready', 'Weekend to 2 week trips', 'All travel expenses covered by client', 'Wardrobe suitable for any occasion', 'Complete discretion'],
     true, 3)
  ON CONFLICT DO NOTHING;

  -- Subscription tier
  INSERT INTO subscription_tiers (provider_id, monthly_rate, description, perks)
  VALUES (
    pid, 1999,
    'Access exclusive photos, behind-the-scenes content and priority enquiries.',
    ARRAY[
      'Exclusive photo sets (2x per week)',
      'Behind-the-scenes content',
      'Priority response on enquiries',
      'Early access to availability',
      'Private messaging'
    ]
  ) ON CONFLICT (provider_id) DO NOTHING;

END $$;
