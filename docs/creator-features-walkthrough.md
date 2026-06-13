# Creator Features — Walkthrough (scenarios & URLs)

Base URL in dev: **http://localhost:3001**
Everything below requires `NEXT_PUBLIC_USE_CREATOR_CONTENT=true` and migrations
071–077 applied. Payment steps need a live Payram instance.

---

## 1. Become a creator: set a subscription tier
**Who:** a provider account
**URL:** `/profile/subscription`
Set a monthly price + perks and toggle it active. This is what powers the
"Subscribe · CA$X/mo" button on your public profile.

## 2. Turn on adult content (viewer) + verify age
**URL:** `/profile/privacy` → "Show adult content" toggle
It's locked until you're age-verified. Verify at **`/profile/verify`** (Yoti).
Without this, suggestive/explicit posts stay hidden for you.

## 3. Create a premium / PPV post
**Where:** Home feed → the **publish (+)** button → composer
**URL:** `/` (social feed home)
In the composer choose **Visibility**: Public / Subscribers / Pay-per-view
(+ price), and a **Content rating** (SFW / Suggestive / Explicit). Explicit
requires you to be age-verified and to tick the consent box; explicit posts go
to admin review before appearing.

## 4. See a locked post (PPV / subscribers-only)
**URL:** `/` (feed) or a creator profile `/u/<username>`
Premium posts render as a **blurred locked card** with **Unlock · CA$X**
(pay-per-view) or **Subscribe to view** (subscribers-only). After you
subscribe/unlock, the media loads via a secure expiring link.

## 5. Subscribe to a creator (paid)
**URL:** `/u/<username>` → **Subscribe · CA$X/mo**
Opens a Payram checkout. On payment confirmation your subscription activates and
unlocks their subscribers-only content.

## 6. Tip a creator
**URL:** `/u/<username>` → **Send a tip**
Pick a preset or custom amount → Payram checkout.

## 7. Pay-per-view direct message
**URL:** `/messages/<username>`
As a creator: tap the **lock icon** next to the photo button, set a price, then
send a photo — it's delivered locked. As the recipient: you see a **Locked
photo** bubble with **Unlock · CA$X**; after paying, the photo reveals.

## 8. Creator earnings & payout
**URL:** `/profile/earnings`
Shows **Available / Pending / Lifetime** and payout history. Confirmed sales
land in *pending*, move to *available* after the hold window (auto, hourly), then
you can **Withdraw**.

## 9. Manage / cancel subscriptions (as a fan)
**URL:** `/profile/subscriptions`
Lists active + past subscriptions; **Cancel** keeps access until the paid period
ends.

## 10. Admin: review explicit content
**URL:** `/admin` → "Explicit content review" → `/admin/moderation`
Approve/reject pending explicit posts. Approved posts become eligible for the
feed; rejected stay hidden. (Requires your UUID in `ADMIN_USER_IDS`.)

## 11. Admin: verify Payram is connected
**URL (API):** `GET /api/admin/payram-health`
Returns whether Payram env is set and the server is reachable.

---

## M5: Live shows
- **Go live (creator):** `/live/new` → creates a show → broadcaster studio at
  `/live/<id>`.
- **Watch (viewer):** `/live/<id>` → buy a ticket (Payram) if priced, then the
  stream plays; tip in-stream.
- **Discover:** `/live` lists currently-live shows.

## M5: All-access bundles
- **Buy a bundle (fan):** `/bundles` → one pass unlocks every creator's
  subscriber-only content. Once active, locked subscriber-only cards across the
  feed unlock automatically.
- **Create a bundle (admin):** `/admin/bundles` → set name + monthly price,
  toggle active.

## Compliance controls
- **Region block:** set `ADULT_BLOCKED_COUNTRIES=US,GB,…` → adult content is
  withheld for those countries (feed + media).
- **2257 capture:** posting an Explicit item (creator must be age-verified) shows
  fields for performer @usernames + a consent-doc upload; admins see these in
  `/admin/moderation`.
- **CSAM scan:** set `CSAM_SCAN_ENDPOINT` + `MODERATION_SCAN_SECRET`, then call
  `POST /api/moderation/scan` (e.g. from a Storage webhook) with `{ postId }`.
