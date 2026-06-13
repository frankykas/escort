-- =============================================================================
-- Cleopatra — Migration 073: Creator Monetization (M3)
-- Adds tips, paid DMs, and the creator payout pipeline on top of 072.
--   • content_unlocks / payments: allow 'message' (paid DM unlocks)
--   • chat_messages: is_locked + unlock_price (PPV direct messages)
--   • tips, payouts tables
--   • payments: creator_id + maturation columns (hold window before payout)
--   • confirm_payram_payment: handle 'message', record tips, set maturation
--   • mature_creator_balances(): pending → available after the hold window
--   • request_payout(): withdraw from available, queue a payout
-- =============================================================================


-- ── Allow 'message' content type / purpose ───────────────────────────────────

ALTER TABLE content_unlocks DROP CONSTRAINT IF EXISTS content_unlocks_content_type_check;
ALTER TABLE content_unlocks
  ADD CONSTRAINT content_unlocks_content_type_check
  CHECK (content_type IN ('post', 'listing', 'message'));

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('subscription', 'ppv', 'tip', 'message'));


-- ── Paid DMs ─────────────────────────────────────────────────────────────────

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS is_locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlock_price integer;   -- cents; NULL when not locked


-- ── payments: creator + maturation ───────────────────────────────────────────
-- creator_id is resolved at confirm time so payouts/maturation don't re-resolve.
-- available_at = confirmed_at + hold window; matured flips once moved to available.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS creator_id   uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS available_at timestamptz,
  ADD COLUMN IF NOT EXISTS matured      boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS payments_maturation_idx
  ON payments (available_at) WHERE status = 'confirmed' AND matured = false;


-- ── tips ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tips (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount      integer     NOT NULL,            -- cents
  payment_id  uuid        REFERENCES payments(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tips: participant read"
  ON tips FOR SELECT USING (from_id = auth.uid() OR creator_id = auth.uid());


-- ── payouts ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payouts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount       integer     NOT NULL,           -- cents
  status       text        NOT NULL DEFAULT 'requested'
                           CHECK (status IN ('requested', 'processing', 'paid', 'failed')),
  destination  jsonb,                          -- payout rail details (e.g. wallet)
  requested_at timestamptz NOT NULL DEFAULT now(),
  paid_at      timestamptz
);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts: creator read own"
  ON payouts FOR SELECT USING (creator_id = auth.uid());


-- ── confirm_payram_payment (replaces 072 version) ────────────────────────────
-- Now also: handles 'message' unlocks, records tips, stamps creator_id +
-- available_at for maturation.

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

  -- Resolve the earning creator per purpose, and apply the entitlement.
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

  ELSIF pay.purpose = 'tip' THEN
    v_creator_id := pay.reference_id;
    INSERT INTO tips (from_id, creator_id, amount, payment_id)
    VALUES (pay.payer_id, v_creator_id, pay.amount, pay.id);
  END IF;

  -- Mark confirmed + schedule maturation.
  SELECT COALESCE((SELECT value::int FROM platform_settings WHERE key = 'payout_hold_days'), 7)
    INTO v_hold_days;

  UPDATE payments
     SET status = 'confirmed',
         confirmed_at = now(),
         creator_id = v_creator_id,
         available_at = now() + (v_hold_days || ' days')::interval
   WHERE id = pay.id;

  -- Credit pending balance + notify the creator.
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
        ELSE 'You received a tip'
      END,
      pay.id, 'payment'
    );
  END IF;

  RETURN 'confirmed';
END;
$$;


-- ── mature_creator_balances() ────────────────────────────────────────────────
-- Moves matured funds pending → available. Run on a schedule (cron / edge fn).

CREATE OR REPLACE FUNCTION mature_creator_balances()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE creator_balances cb
     SET available = cb.available + agg.total,
         pending   = GREATEST(cb.pending - agg.total, 0),
         updated_at = now()
    FROM (
      SELECT creator_id, SUM(amount) AS total
        FROM payments
       WHERE status = 'confirmed' AND matured = false
         AND creator_id IS NOT NULL AND available_at <= now()
       GROUP BY creator_id
    ) agg
   WHERE cb.creator_id = agg.creator_id;

  UPDATE payments
     SET matured = true
   WHERE status = 'confirmed' AND matured = false
     AND creator_id IS NOT NULL AND available_at <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ── request_payout(creator_id, amount, destination) ──────────────────────────
-- Withdraws from available balance and queues a payout. Returns the payout id,
-- or 'insufficient'. Callers must pass a server-validated creator_id.

CREATE OR REPLACE FUNCTION request_payout(
  p_creator_id  uuid,
  p_amount      integer,
  p_destination jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available integer;
  v_payout_id uuid;
BEGIN
  IF p_amount <= 0 THEN RETURN 'invalid'; END IF;

  SELECT available INTO v_available
    FROM creator_balances WHERE creator_id = p_creator_id FOR UPDATE;

  IF v_available IS NULL OR v_available < p_amount THEN
    RETURN 'insufficient';
  END IF;

  UPDATE creator_balances
     SET available = available - p_amount, updated_at = now()
   WHERE creator_id = p_creator_id;

  INSERT INTO payouts (creator_id, amount, destination)
  VALUES (p_creator_id, p_amount, p_destination)
  RETURNING id INTO v_payout_id;

  RETURN v_payout_id::text;
END;
$$;
