-- =============================================================================
-- Cleopatra — Migration 009: Enriched Listing Fields
-- Adds booking logistics fields to listings.
-- =============================================================================

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS advance_notice_hours  integer,          -- min hours notice to book
  ADD COLUMN IF NOT EXISTS deposit_required      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount        integer,          -- cents; null = provider discretion
  ADD COLUMN IF NOT EXISTS outcall_areas         text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cancellation_policy   text;

-- Update mock listings with realistic data
UPDATE listings SET
  advance_notice_hours = 2,
  deposit_required     = false,
  outcall_areas        = ARRAY['Downtown', 'Midtown', 'Airport', 'North York']
WHERE provider_id = (SELECT id FROM profiles WHERE username = 'themarketco')
  AND service_type IN ('GFE', 'Companionship');

UPDATE listings SET
  advance_notice_hours = 24,
  deposit_required     = true,
  deposit_amount       = 5000,
  outcall_areas        = ARRAY['All Toronto', 'GTA'],
  cancellation_policy  = '24 hours notice required for full refund.'
WHERE provider_id = (SELECT id FROM profiles WHERE username = 'themarketco')
  AND service_type IN ('Dinner Date', 'Travel');
