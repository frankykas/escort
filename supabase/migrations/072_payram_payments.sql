-- =============================================================================
-- Cleopatra — Migration 072: Payram Payments (M2)
-- Adds the payments source-of-truth table, creator balance ledger, and an
-- idempotent confirmation RPC invoked by the Payram webhook.
--
-- Reuses 008's subscriptions / subscription_tiers / content_unlocks.
-- Amounts are integer minor units (cents), per project convention. Payram works
-- in USD (amountInUSD); minor units are treated as USD cents for now (FX is a
-- documented follow-up — see docs/onlyfans-plan.md).
-- =============================================================================


-- ── payments ─────────────────────────────────────────────────────────────────
-- One row per attempted transaction. provider_ref holds Payram's reference_id,
-- which is how the webhook maps a confirmation back to our intent. UNIQUE on it
-- makes webhook retries idempotent at the DB layer.

CREATE TABLE IF NOT EXISTS payments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purpose       text        NOT NULL CHECK (purpose IN ('subscription', 'ppv', 'tip')),
  reference_id  uuid,                       -- tier id (sub), post id (ppv), creator id (tip)
  amount        integer     NOT NULL,       -- cents
  currency      text        NOT NULL DEFAULT 'usd',
  provider      text        NOT NULL DEFAULT 'payram',
  provider_ref  text        UNIQUE,         -- Payram reference_id
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  confirmed_at  timestamptz
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS payments_payer_idx ON payments (payer_id);
CREATE INDEX IF NOT EXISTS payments_provider_ref_idx ON payments (provider_ref);

-- Payers can read their own payments. Inserts/updates happen only via the
-- service-role client in our Route Handlers, which bypasses RLS.
CREATE POLICY "payments: payer read own"
  ON payments FOR SELECT USING (payer_id = auth.uid());


-- ── creator_balances ─────────────────────────────────────────────────────────
-- Running earnings per creator. Confirmed payments credit `pending`; a future
-- payout job moves matured funds pending → available (chargeback/refund buffer).

CREATE TABLE IF NOT EXISTS creator_balances (
  creator_id  uuid        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  available   integer     NOT NULL DEFAULT 0,   -- cents, withdrawable
  pending     integer     NOT NULL DEFAULT 0,   -- cents, within hold window
  lifetime    integer     NOT NULL DEFAULT 0,   -- cents, gross ever earned
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE creator_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "creator_balances: creator read own"
  ON creator_balances FOR SELECT USING (creator_id = auth.uid());


-- ── confirm_payram_payment(reference_id, filled_usd) ──────────────────────────
-- Idempotently confirms a payment and applies its side effects in one
-- transaction. Returns one of: 'unknown', 'already', 'underpaid', 'confirmed'.
--
--   subscription → activate/extend subscriptions, credit creator balance
--   ppv          → insert content_unlocks, credit creator balance
--   tip          → credit creator balance
--
-- SECURITY DEFINER so the service-role webhook can run it; search_path pinned.

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
BEGIN
  -- Lock the payment row so concurrent webhook retries serialize.
  SELECT * INTO pay FROM payments WHERE provider_ref = p_reference_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'unknown';
  END IF;

  IF pay.status = 'confirmed' THEN
    RETURN 'already';
  END IF;

  -- If Payram reports an underpayment, leave the row pending for a later top-up.
  IF p_filled_usd IS NOT NULL AND (p_filled_usd * 100) < pay.amount THEN
    RETURN 'underpaid';
  END IF;

  UPDATE payments
     SET status = 'confirmed', confirmed_at = now()
   WHERE id = pay.id;

  IF pay.purpose = 'subscription' THEN
    -- reference_id = tier id → resolve the creator.
    SELECT provider_id INTO v_creator_id
      FROM subscription_tiers WHERE id = pay.reference_id;
    IF v_creator_id IS NULL THEN
      RETURN 'confirmed';   -- payment recorded; tier vanished, nothing to grant
    END IF;

    -- Extend from the later of now / existing period end.
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

  ELSIF pay.purpose = 'ppv' THEN
    -- reference_id = post id → resolve the creator.
    SELECT provider_id INTO v_creator_id
      FROM status_updates WHERE id = pay.reference_id;

    INSERT INTO content_unlocks (user_id, content_id, content_type, amount_paid)
    VALUES (pay.payer_id, pay.reference_id, 'post', pay.amount)
    ON CONFLICT (user_id, content_id, content_type) DO NOTHING;

  ELSIF pay.purpose = 'tip' THEN
    v_creator_id := pay.reference_id;
  END IF;

  -- Credit the creator's pending balance.
  IF v_creator_id IS NOT NULL THEN
    INSERT INTO creator_balances (creator_id, pending, lifetime, updated_at)
    VALUES (v_creator_id, pay.amount, pay.amount, now())
    ON CONFLICT (creator_id)
    DO UPDATE SET pending  = creator_balances.pending + pay.amount,
                  lifetime = creator_balances.lifetime + pay.amount,
                  updated_at = now();

    -- Notify the creator (mirrors the notifications pattern used elsewhere).
    INSERT INTO notifications (recipient_id, actor_id, type, title, body, reference_id, reference_type)
    VALUES (
      v_creator_id, pay.payer_id, 'payment_received',
      'Payment received',
      CASE pay.purpose
        WHEN 'subscription' THEN 'You have a new subscriber'
        WHEN 'ppv'          THEN 'Someone unlocked your content'
        ELSE 'You received a tip'
      END,
      pay.id, 'payment'
    );
  END IF;

  RETURN 'confirmed';
END;
$$;
