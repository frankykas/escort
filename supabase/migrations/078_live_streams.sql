-- =============================================================================
-- Cleopatra — Migration 078: Ticketed Live Shows (M5)
-- Creators host A/V live shows over LiveKit; viewers buy a ticket (or join free)
-- and can tip in-stream. Tickets reuse the payments + content_unlocks rails.
--   • live_streams — one row per show
--   • content_unlocks / payments accept 'stream'
--   • confirm_payram_payment grants a stream ticket + credits the creator
-- =============================================================================


-- ── Allow 'stream' content type / purpose ────────────────────────────────────

ALTER TABLE content_unlocks DROP CONSTRAINT IF EXISTS content_unlocks_content_type_check;
ALTER TABLE content_unlocks
  ADD CONSTRAINT content_unlocks_content_type_check
  CHECK (content_type IN ('post', 'listing', 'message', 'stream'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('subscription', 'ppv', 'tip', 'message', 'stream'));


-- ── live_streams ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS live_streams (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  status        text        NOT NULL DEFAULT 'live'
                            CHECK (status IN ('scheduled', 'live', 'ended')),
  ticket_price  integer     NOT NULL DEFAULT 0,   -- cents; 0 = free to join
  room_name     text        NOT NULL UNIQUE,      -- LiveKit room
  viewer_count  integer     NOT NULL DEFAULT 0,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS live_streams_live_idx
  ON live_streams (status, started_at DESC) WHERE status = 'live';

-- Anyone can see streams (the ticket gate happens at token issuance).
CREATE POLICY "live_streams: public read"
  ON live_streams FOR SELECT USING (true);

-- Creators manage their own streams.
CREATE POLICY "live_streams: creator manage"
  ON live_streams FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());


-- ── confirm_payram_payment (replaces 073 version) ────────────────────────────
-- Adds 'stream' ticket handling. Unchanged otherwise.

CREATE OR REPLACE FUNCTION confirm_payram_payment(
  p_reference_id text,
  p_filled_usd   numeric DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay          payments%ROWTYPE;
  v_creator_id uuid;
  v_period_end timestamptz;
  v_hold_days  integer;
BEGIN
  SELECT * INTO pay FROM payments WHERE provider_ref = p_reference_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;
  IF pay.status = 'confirmed' THEN RETURN 'already'; END IF;

  IF p_filled_usd IS NOT NULL AND (p_filled_usd * 100) < pay.amount THEN
    RETURN 'underpaid';
  END IF;

  IF pay.purpose = 'subscription' THEN
    SELECT provider_id INTO v_creator_id
      FROM subscription_tiers WHERE id = pay.reference_id;

    IF v_creator_id IS NOT NULL THEN
      SELECT GREATEST(COALESCE(current_period_end, now()), now()) INTO v_period_end
        FROM subscriptions
       WHERE subscriber_id = pay.payer_id AND provider_id = v_creator_id;
      v_period_end := COALESCE(v_period_end, now()) + interval '1 month';

      INSERT INTO subscriptions (subscriber_id, provider_id, tier_id, status, current_period_end)
      VALUES (pay.payer_id, v_creator_id, pay.reference_id, 'active', v_period_end)
      ON CONFLICT (subscriber_id, provider_id)
      DO UPDATE SET status = 'active',
                    tier_id = EXCLUDED.tier_id,
                    current_period_end = EXCLUDED.current_period_end;
    END IF;

  ELSIF pay.purpose = 'ppv' THEN
    SELECT provider_id INTO v_creator_id
      FROM status_updates WHERE id = pay.reference_id;
    INSERT INTO content_unlocks (user_id, content_id, content_type, amount_paid)
    VALUES (pay.payer_id, pay.reference_id, 'post', pay.amount)
    ON CONFLICT (user_id, content_id, content_type) DO NOTHING;

  ELSIF pay.purpose = 'message' THEN
    SELECT sender_id INTO v_creator_id
      FROM chat_messages WHERE id = pay.reference_id;
    INSERT INTO content_unlocks (user_id, content_id, content_type, amount_paid)
    VALUES (pay.payer_id, pay.reference_id, 'message', pay.amount)
    ON CONFLICT (user_id, content_id, content_type) DO NOTHING;

  ELSIF pay.purpose = 'stream' THEN
    SELECT creator_id INTO v_creator_id
      FROM live_streams WHERE id = pay.reference_id;
    INSERT INTO content_unlocks (user_id, content_id, content_type, amount_paid)
    VALUES (pay.payer_id, pay.reference_id, 'stream', pay.amount)
    ON CONFLICT (user_id, content_id, content_type) DO NOTHING;

  ELSIF pay.purpose = 'tip' THEN
    v_creator_id := pay.reference_id;
    INSERT INTO tips (from_id, creator_id, amount, payment_id)
    VALUES (pay.payer_id, v_creator_id, pay.amount, pay.id);
  END IF;

  SELECT COALESCE((SELECT value::int FROM platform_settings WHERE key = 'payout_hold_days'), 7)
    INTO v_hold_days;

  UPDATE payments
     SET status = 'confirmed',
         confirmed_at = now(),
         creator_id = v_creator_id,
         available_at = now() + (v_hold_days || ' days')::interval
   WHERE id = pay.id;

  IF v_creator_id IS NOT NULL THEN
    INSERT INTO creator_balances (creator_id, pending, lifetime, updated_at)
    VALUES (v_creator_id, pay.amount, pay.amount, now())
    ON CONFLICT (creator_id)
    DO UPDATE SET pending  = creator_balances.pending + pay.amount,
                  lifetime = creator_balances.lifetime + pay.amount,
                  updated_at = now();

    INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_id, reference_type)
    VALUES (
      v_creator_id, pay.payer_id, 'payment_received', 'Payment received',
      CASE pay.purpose
        WHEN 'subscription' THEN 'You have a new subscriber'
        WHEN 'ppv'          THEN 'Someone unlocked your content'
        WHEN 'message'      THEN 'Someone unlocked your message'
        WHEN 'stream'       THEN 'Someone bought a ticket to your show'
        ELSE 'You received a tip'
      END,
      pay.id, 'payment'
    );
  END IF;

  RETURN 'confirmed';
END;
$$;
