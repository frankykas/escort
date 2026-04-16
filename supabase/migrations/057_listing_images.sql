-- ============================================================================
-- Migration 057: Listing images — multi-image galleries for listings
-- ============================================================================
-- Each listing can have up to 6 images. Images are stored in a dedicated
-- Supabase Storage bucket and referenced via this table.
-- ============================================================================

-- 1. Storage bucket for listing images
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-images', 'listing-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "storage: listing-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listing-images');

-- Authenticated upload
CREATE POLICY "storage: listing-images authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'listing-images'
    AND auth.role() = 'authenticated'
  );

-- Owner update
CREATE POLICY "storage: listing-images owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner delete
CREATE POLICY "storage: listing-images owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'listing-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- 2. Listing images table
CREATE TABLE IF NOT EXISTS listing_images (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url         text NOT NULL,
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by listing
CREATE INDEX listing_images_listing_idx ON listing_images (listing_id, sort_order);

-- RLS
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read images for active listings
CREATE POLICY "listing_images: public read"
  ON listing_images FOR SELECT
  USING (true);

-- Provider can insert images for their own listings
CREATE POLICY "listing_images: owner insert"
  ON listing_images FOR INSERT
  WITH CHECK (provider_id = auth.uid());

-- Provider can update their own images (reorder)
CREATE POLICY "listing_images: owner update"
  ON listing_images FOR UPDATE
  USING (provider_id = auth.uid());

-- Provider can delete their own images
CREATE POLICY "listing_images: owner delete"
  ON listing_images FOR DELETE
  USING (provider_id = auth.uid());
