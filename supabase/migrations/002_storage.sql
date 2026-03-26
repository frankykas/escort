-- =============================================================================
-- Cleopatra — Storage Migration 002
-- Creates the 'status-updates' bucket and its RLS policies.
-- Run this in Supabase SQL Editor after 001_core_schema.sql.
-- =============================================================================

-- Create the bucket (public = images are readable without a token)
INSERT INTO storage.buckets (id, name, public)
VALUES ('status-updates', 'status-updates', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read objects (serve images to the feed)
CREATE POLICY "storage: status-updates public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'status-updates');

-- Only authenticated users can upload
CREATE POLICY "storage: status-updates authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'status-updates'
    AND auth.role() = 'authenticated'
  );

-- Users can only update their own files (stored under {user_id}/...)
CREATE POLICY "storage: status-updates owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'status-updates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can only delete their own files
CREATE POLICY "storage: status-updates owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'status-updates'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
