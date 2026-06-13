-- =============================================================================
-- Cleopatra — Migration 081: Remove stale get_feed_posts overloads
-- A previous 5-argument get_feed_posts still exists alongside the current
-- 6-argument version (…, p_allow_adult boolean DEFAULT false). Because the new
-- arg is defaulted, a 5-arg call matches BOTH, so PostgREST errors with
-- "Could not choose the best candidate function …".
--
-- Drop every old 5-arg signature; keep only the current 6-arg one (075).
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_feed_posts(text, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_feed_posts(character, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_feed_posts(varchar, text, integer, integer, integer);
DROP FUNCTION IF EXISTS public.get_feed_posts(char(2), text, integer, integer, integer);

-- Refresh PostgREST's schema cache so the change is picked up immediately.
NOTIFY pgrst, 'reload schema';
