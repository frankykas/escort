-- Remove visible seed/debug labels from existing post captions.
-- Run once in the Supabase SQL editor if you already see "[Seed:Search]" in the app.

UPDATE public.status_updates
SET caption = NULLIF(
  trim(
    regexp_replace(
      regexp_replace(caption, '\s*\[seed:search\]\s*', ' ', 'gi'),
      '\s+[0-9]+\)\s*$',
      '',
      'g'
    )
  ),
  ''
)
WHERE caption ~* '\[seed:search\]'
   OR caption ~ '\s+[0-9]+\)\s*$';

SELECT
  count(*) AS captions_still_containing_seed_search
FROM public.status_updates
WHERE caption ~* '\[seed:search\]';

SELECT
  count(*) AS captions_still_ending_with_number_paren
FROM public.status_updates
WHERE caption ~ '\s+[0-9]+\)\s*$';
