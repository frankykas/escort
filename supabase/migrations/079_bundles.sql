-- =============================================================================
-- Cleopatra — Migration 079: Platform Bundle Packages (M5)
-- An all-access pass: one subscription that unlocks every creator's
-- subscribers-only content platform-wide. (PPV posts/DMs and stream tickets are
-- separate one-off purchases and are NOT covered by a bundle.)
--
-- Bundle revenue is pooled (payments.creator_id stays NULL, so it does not credit
-- any single creator_balances row). Fair revenue-split to creators based on
-- engagement is a documented follow-up — see docs/onlyfans-plan.md.
-- =============================================================================


-- ── Allow 'bundle' purpose ───────────────────────────────────────────────────

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_purpose_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_purpose_check
  CHECK (purpose IN ('subscription', 'ppv', 'tip', 'message', 'stream', 'bundle'));


-- ── bundles ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bundles (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  description    text,
  monthly_price  integer     NOT NULL,          -- cents
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bundles: public read active"
  ON bundles FOR SELECT USING (is_active = true);


-- ── bundle_subscriptions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bundle_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bundle_id           uuid        NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, bundle_id)
);

ALTER TABLE bundle_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS bundle_subscriptions_active_idx
  ON bundle_subscriptions (subscriber_id) WHERE status = 'active';

CREATE POLICY "bundle_subscriptions: read own"
  ON bundle_subscriptions FOR SELECT USING (subscriber_id = auth.uid());

CREATE POLICY "bundle_subscriptions: subscriber update"
  ON bundle_subscriptions FOR UPDATE USING (subscriber_id = auth.uid());


-- ── confirm_payram_payment (replaces 078 version) ────────────────────────────
-- Adds 'bundle': grants/extends an all-access subscription. Pooled revenue, so
-- no creator_balances credit.

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

  ELSIF pay.purpose = 'bundle' THEN
    -- All-access pass. Pooled revenue → no single creator credited.
    SELECT GREATEST(COALESCE(current_period_end, now()), now()) INTO v_period_end
      FROM bundle_subscriptions
     WHERE subscriber_id = pay.payer_id AND bundle_id = pay.reference_id;
    v_period_end := COALESCE(v_period_end, now()) + interval '1 month';

    INSERT INTO bundle_subscriptions (subscriber_id, bundle_id, status, current_period_end)
    VALUES (pay.payer_id, pay.reference_id, 'active', v_period_end)
    ON CONFLICT (subscriber_id, bundle_id)
    DO UPDATE SET status = 'active', current_period_end = EXCLUDED.current_period_end;

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
