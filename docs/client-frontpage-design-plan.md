# Cleopatra UX Expansion Plan

## Product Goal

Cleopatra should feel like a simple, premium, privacy-first companion discovery app. The first screen should work like an Instagram-style landing page for signed-out visitors: brand, promise, hero visual, and two clear actions. Once signed in, providers need practical tools to publish listings, posts, videos, profile details, availability, and paid visibility.

## Anonymous Front Page

- Create a clean first viewport with the Cleopatra logo, language/sign-in entry, short value proposition, hero portrait, and trust signals.
- Make the product obvious immediately: adult companion discovery, verified profiles, private messaging, discretion, security, and curated experiences.
- Use simple CTAs:
  - Primary: browse/discover profiles.
  - Secondary: create an account.
- Avoid a busy marketing site. No large feature sections before the user understands the app.
- Hide signed-in app navigation from anonymous visitors on `/`.
- Keep mobile first: the first viewport must still show brand, headline, CTA, image, and a hint of trust content.

## Visual Direction

- Brand feeling: elegant, discreet, feminine, modern Cleopatra.
- Palette: white, blush pink, soft gold accents, deep slate text.
- Hero image: realistic editorial portrait, tasteful and non-explicit, with gold styling and enough negative space.
- UI style: rounded but polished, not overly card-heavy; CTAs should be obvious and tappable.

## Feed And Posts

- Feed posts must support both image and video media.
- Video upload must accept MP4, WebM, and MOV files.
- Video previews must render before publish.
- Video playback must work in the feed and post modal.
- Tapping/clicking the video should toggle play/pause, while native controls remain available.
- Feed cards should continue to show provider username, verification, active/last-seen indicator, follow action, likes, comments, views, and caption.
- Video posts should not accidentally navigate away when the user is trying to play/pause.

## Upload Flow

- Main upload screen should support:
  - Feed posts with image, video, or text.
  - Stories with required media.
  - Captions.
  - Premium/pay-per-view settings for posts.
  - Credit enforcement if posting packages are enabled.
- Upload validation:
  - Accept JPEG, PNG, WebP, MP4, WebM, MOV.
  - Reject unsupported files with a clear error.
  - Reject files over 80 MB.
  - Compress images only; never try to canvas-compress videos.
- API behavior:
  - A post may be created with caption, media, or both.
  - `media_type` must be saved as `image`, `video`, or `text`.

## Listing Creation

- Listing creation should be step-by-step, similar to Leolist:
  - Step 1: photos.
  - Step 2: basics.
  - Step 3: details and description.
  - Step 4: schedule.
  - Step 5: review and publish.
- Show progress as “Step X of 5.”
- Add pro tips throughout the flow.
- Allow users to schedule listings for a future date/time.
- If scheduled, listing should remain inactive until the scheduled time.
- Before publishing a new adult listing, show a required terms popup.
- Terms popup must clearly state that by publishing in the adult section, the provider agrees not to post illegal images, illegal content, trafficking, coercion, underage content, prohibited services, impersonation, or misleading claims.

## Provider Profiles

- Provider profile edit should include:
  - City and country.
  - Phone/contact details.
  - Website.
  - Social links: TikTok, Snapchat, Instagram, OnlyFans, Twitter/X, Facebook.
  - Optional body details: hip size, bust size, cup size, eye color.
  - Availability schedule.
  - Visibility toggles for contact details and social links.
- Public profiles should show these fields only when the provider has added them and visibility settings allow it.

## Activity And Availability

- Feed/profile surfaces should show active or last-seen status.
- Providers should be able to set availability so clients know when to reach out.
- Status indicators must remain discreet and should not feel like surveillance.

## Bumps And Promotion

- Add a bump education module before purchase.
- Explain:
  - What a bump does.
  - How long it lasts.
  - Where the listing appears.
  - Why it can increase visibility.
  - Cost by tier.
- Keep bump tiers clear:
  - Basic: Explore stories/featured area.
  - Premium: additional similar-profile placement.
  - Maximum: strongest Explore visibility.

## Ads

- Add simple Leolist-style sponsored placements.
- Sponsored placements should be clearly labeled.
- Initial example ad: `SecretBenefits.ca`.
- Ads should feel native to the browsing flow without being mistaken for provider profiles.

## Verification, Privacy, And Safety

- Messaging should consistently emphasize:
  - Private in-app messages.
  - Discreet verification.
  - Privacy-first discovery.
  - Security and confidentiality.
- Verification language should be trust-building, not intimidating.
- Adult-content safety requirements should appear at the moment of publishing, not hidden in legal pages only.

## Current Implementation Status

- Front page has been rebuilt with the light Cleopatra landing direction.
- Local generated hero image is stored at `public/cleopatra-hero.png`.
- Anonymous bottom navigation is hidden on `/`.
- Provider profile fields, listing scheduling, listing terms, active indicators, bumps, and feed video support exist in the codebase.
- Main upload flow has been updated to accept and save videos.
- Feed and post modal videos now have explicit click/tap play-pause behavior.
- Explore includes a native sponsored ad placement for `SecretBenefits.ca`.

## Remaining QA Checklist

- Upload one MP4, one WebM, and one MOV in the main upload flow.
- Confirm each saves to Supabase Storage and creates a `status_updates` row with `media_type = video`.
- Confirm videos appear in Explore feed.
- Confirm tapping video toggles play/pause on desktop and mobile.
- Confirm controls still allow scrubbing, mute, fullscreen where supported, and pause.
- Confirm post modal playback works.
- Confirm story video upload and story playback if stories are part of the client acceptance scope.
- Confirm listing scheduled publish behavior with real future timestamps.
- Confirm terms acceptance persists on the listing row.
- Confirm sponsored ad link opens externally and is visually labeled as sponsored.
