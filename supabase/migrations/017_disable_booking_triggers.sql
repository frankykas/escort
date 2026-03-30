-- ============================================================================
-- Migration 017: Disable booking notification triggers
-- ============================================================================
-- The platform operates as a classifieds marketplace, not a booking
-- intermediary. We keep the bookings table and schema intact (guarded by
-- USE_BOOKINGS feature flag) but drop the automatic notification triggers
-- so they don't fire even if the table is written to programmatically.
-- ============================================================================

-- Drop the 5 booking-related notification triggers from migration 016
DROP TRIGGER IF EXISTS trg_notify_booking_requested ON bookings;
DROP TRIGGER IF EXISTS trg_notify_booking_accepted  ON bookings;
DROP TRIGGER IF EXISTS trg_notify_booking_declined  ON bookings;
DROP TRIGGER IF EXISTS trg_notify_booking_completed ON bookings;
DROP TRIGGER IF EXISTS trg_notify_booking_cancelled ON bookings;

-- Drop the corresponding trigger functions
DROP FUNCTION IF EXISTS notify_booking_requested();
DROP FUNCTION IF EXISTS notify_booking_accepted();
DROP FUNCTION IF EXISTS notify_booking_declined();
DROP FUNCTION IF EXISTS notify_booking_completed();
DROP FUNCTION IF EXISTS notify_booking_cancelled();
