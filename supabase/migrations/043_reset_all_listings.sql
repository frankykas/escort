-- ============================================================================
-- Migration 043: Reset all listings
-- ============================================================================
-- Wipe all existing listings and bumps so providers start fresh
-- with the new first-listing-free system.
-- ============================================================================

-- Clear bumps first (FK dependency)
DELETE FROM listing_bumps;

-- Clear all listings
DELETE FROM listings;
