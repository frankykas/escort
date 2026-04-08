-- ============================================================================
-- 036: Fix credit grant — insert purchase rows so deduct_post_credit works
-- ============================================================================
-- Migration 029 only bumped profiles.post_credits_balance but never created
-- a posting_package_purchases row.  deduct_post_credit() looks for a purchase
-- with credits_remaining > 0, so deductions always failed.
--
-- This migration inserts a "free grant" purchase row for every provider that
-- has a positive balance but no matching purchase row.

INSERT INTO posting_package_purchases (
  provider_id,
  credits_purchased,
  credits_remaining,
  purchased_at
)
SELECT
  p.id,
  p.post_credits_balance,
  p.post_credits_balance,
  now()
FROM profiles p
WHERE p.is_provider = true
  AND p.post_credits_balance > 0
  AND NOT EXISTS (
    SELECT 1 FROM posting_package_purchases pp
    WHERE pp.provider_id = p.id
      AND pp.credits_remaining > 0
  );
