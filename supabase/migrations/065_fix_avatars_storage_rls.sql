-- ============================================================================
-- Migration 065: Fix avatars storage RLS (UPDATE policy missing WITH CHECK)
-- ============================================================================
-- The original `avatars owner update` policy in migration 010 uses USING
-- without a matching WITH CHECK clause. Under newer supabase-storage versions
-- this causes `upload(..., { upsert: true })` to be rejected with
-- "new row violates row-level security policy" on any attempt to overwrite
-- an existing avatar — every second avatar change fails.
--
-- The client now writes to timestamped paths so upsert isn't strictly needed
-- anymore, but fixing the policy keeps both paths (legacy upsert + new
-- timestamped INSERT) working correctly.
-- ============================================================================

-- 1. Make sure the bucket exists (idempotent — defensive for fresh projects)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop and re-create all four avatars policies with correct semantics

DROP POLICY IF EXISTS "storage: avatars public read"    ON storage.objects;
DROP POLICY IF EXISTS "storage: avatars owner upload"   ON storage.objects;
DROP POLICY IF EXISTS "storage: avatars owner update"   ON storage.objects;
DROP POLICY IF EXISTS "storage: avatars owner delete"   ON storage.objects;

-- Public can read any avatar
CREATE POLICY "storage: avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated user can upload into their own folder
CREATE POLICY "storage: avatars owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can update their own avatar (both pre- and post-update must match)
CREATE POLICY "storage: avatars owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Owner can delete their own avatar
CREATE POLICY "storage: avatars owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
