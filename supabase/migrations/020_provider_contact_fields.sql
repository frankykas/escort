-- ============================================================================
-- Migration 020: Provider Contact Fields
-- ============================================================================
-- Add WhatsApp, Telegram, and phone number to profiles so providers can
-- offer external contact methods alongside in-app messaging.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS contact_whatsapp text,
  ADD COLUMN IF NOT EXISTS contact_telegram text,
  ADD COLUMN IF NOT EXISTS contact_phone text;
