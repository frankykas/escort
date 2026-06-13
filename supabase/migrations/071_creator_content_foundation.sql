-- =============================================================================
-- Cleopatra — Migration 071: Creator Content Foundation (M1)
-- Extends the premium-content layer added in 008:
--   • status_updates.content_rating  — SFW / suggestive / explicit tiering
--   • status_updates.media_path       — private storage key for paywalled media
--   • profiles.adult_content_opt_in   — consumer age-gate opt-in (used in Phase 4)
--   • private 'premium-content' storage bucket + owner-only RLS
--
-- Reuses (does NOT duplicate) 008's subscriptions / content_unlocks /
-- subscription_tiers / status_updates.is_premium / unlock_price.
-- =============================================================================


-- ── Extend status_updates ────────────────────────────────────────────────────
-- content_rating drives the SFW/explicit age gate (Phase 4).
-- media_path holds the key into the private 'premium-content' bucket; public
-- posts continue to use the existing public media_url. A premium post stores its
-- media under media_path and is served only through /api/media/[postId].

ALTER TABLE status_updates
  ADD COLUMN IF NOT EXISTS content_rating text NOT NULL DEFAULT 'sfw'
    CHECK (content_rating IN ('sfw', 'suggestive', 'explicit')),
  ADD COLUMN IF NOT EXISTS media_path text;

CREATE INDEX IF NOT EXISTS status_updates_content_rating_idx
  ON status_updates (content_rating);


-- ── Extend profiles ──────────────────────────────────────────────────────────
-- Consumer opt-in to view adult tiers. Combined with yoti_age_verified (070),
-- this gates suggestive/explicit content in Phase 4.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS adult_content_opt_in boolean NOT NULL DEFAULT false;


-- ── Private storage bucket: premium-content ──────────────────────────────────
-- public = false: objects are NEVER readable by anon/public URL. Reads go
-- exclusively through the service-role client in /api/media/[postId], which
-- checks entitlement (lib/access.ts) before minting a short-TTL signed URL.
-- Media is stored under {provider_id}/... so storage.foldername(name))[1] is the owner.

INSERT INTO storage.buckets (id, name, public)
VALUES ('premium-content', 'premium-content', false)
ON CONFLICT (id) DO NOTHING;

-- Owner (creator) can upload their own premium media.
CREATE POLICY "storage: premium-content owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'premium-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can update their own files.
CREATE POLICY "storage: premium-content owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'premium-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can delete their own files.
CREATE POLICY "storage: premium-content owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'premium-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- NOTE: deliberately NO public SELECT policy. Entitlement-checked reads are
-- performed server-side with the service role, which bypasses RLS.
