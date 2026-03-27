-- =============================================================================
-- Cleopatra — Migration 013: Bookings & Reviews
-- =============================================================================


-- ── bookings ─────────────────────────────────────────────────────────────────
-- Tracks booking requests from clients to providers.
-- Payment always happens offline — this table is for coordination + trust only.

CREATE TABLE IF NOT EXISTS bookings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id      uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id       uuid        REFERENCES listings(id) ON DELETE SET NULL,

  -- Request details (filled by client)
  requested_date   date        NOT NULL,
  requested_time   text,                           -- e.g. "Evening", "14:00"
  duration_minutes integer,
  service_type     text,                           -- incall | outcall
  area             text,                           -- outcall area
  notes            text        CHECK (char_length(notes) <= 1000),

  -- Lifecycle
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','accepted','declined','completed','cancelled')),

  accepted_at      timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  cancelled_by     uuid        REFERENCES profiles(id) ON DELETE SET NULL,

  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT bookings_no_self CHECK (client_id <> provider_id)
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Both parties can read their own bookings
CREATE POLICY "bookings: read own"
  ON bookings FOR SELECT
  USING (client_id = auth.uid() OR provider_id = auth.uid());

-- Clients create bookings
CREATE POLICY "bookings: client insert"
  ON bookings FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Both parties can update (accept/decline/complete/cancel)
CREATE POLICY "bookings: parties update"
  ON bookings FOR UPDATE
  USING (client_id = auth.uid() OR provider_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS bookings_provider_idx ON bookings (provider_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_client_idx   ON bookings (client_id,   status, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION bookings_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_set_updated_at();


-- ── Extend profiles: completed bookings counter ───────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS completed_bookings_count integer NOT NULL DEFAULT 0;

-- Trigger to keep count in sync
CREATE OR REPLACE FUNCTION sync_completed_bookings_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Became completed
    IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
      UPDATE profiles SET completed_bookings_count = completed_bookings_count + 1
        WHERE id = NEW.provider_id;
    END IF;
    -- Un-completed (edge case: admin correction)
    IF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
      UPDATE profiles SET completed_bookings_count = GREATEST(completed_bookings_count - 1, 0)
        WHERE id = NEW.provider_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER on_booking_status_change
  AFTER UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION sync_completed_bookings_count();


-- ── reviews ───────────────────────────────────────────────────────────────────
-- One review per completed booking, written by the client.
-- Gated: booking must have status = 'completed'.

CREATE TABLE IF NOT EXISTS reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid        NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  reviewer_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating       smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         text        CHECK (char_length(body) <= 800),
  is_visible   boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reviews_no_self CHECK (reviewer_id <> reviewee_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read visible reviews
CREATE POLICY "reviews: public read visible"
  ON reviews FOR SELECT
  USING (is_visible = true);

-- Reviewers can always read their own (even hidden)
CREATE POLICY "reviews: reviewer read own"
  ON reviews FOR SELECT
  USING (reviewer_id = auth.uid());

-- Only the client (reviewer) can insert — and only for their own completed bookings
CREATE POLICY "reviews: client insert"
  ON reviews FOR INSERT
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM bookings
      WHERE id = booking_id
        AND client_id = auth.uid()
        AND status = 'completed'
    )
  );

-- Reviewer can delete their own review
CREATE POLICY "reviews: reviewer delete"
  ON reviews FOR DELETE
  USING (reviewer_id = auth.uid());

-- Index for fast per-profile review lookups
CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews (reviewee_id, created_at DESC);

-- ── Extend profiles: cached rating stats ─────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS review_count   integer          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS average_rating numeric(3,2);

-- Trigger to update cached stats after insert/delete
CREATE OR REPLACE FUNCTION sync_profile_review_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_id uuid;
BEGIN
  target_id := COALESCE(NEW.reviewee_id, OLD.reviewee_id);
  UPDATE profiles SET
    review_count   = (SELECT COUNT(*)   FROM reviews WHERE reviewee_id = target_id AND is_visible = true),
    average_rating = (SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE reviewee_id = target_id AND is_visible = true)
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE OR REPLACE TRIGGER on_review_change
  AFTER INSERT OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION sync_profile_review_stats();
