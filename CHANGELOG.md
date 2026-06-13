# Cleopatra — What's New

A summary of everything we've built and improved, newest first.

---

## 3 June 2026 — Free Subscriptions + Feed Fix

### What's New
- **Free subscriptions** — creators can now offer a **$0 subscription** (a "Free subscription" toggle on the subscription-tier screen). Fans subscribe with one tap (no payment) and the creator monetizes through pay-per-view content and tips instead — matching OnlyFans' popular free-subscription model. Paid subscriptions work exactly as before.

### Bug Fixes
- **Feed failed to load with a "could not choose the best candidate function" error** — an old version of the feed database function was still present alongside the new one, so the database couldn't decide which to call. Removed the stale version (migration 081); the feed loads normally again.

---

## 3 June 2026 — Creator Content Platform: All-Access Bundles + Compliance Hardening

### What's New
- **All-access bundle packages** — A single subscription that unlocks the subscribers-only content of *every* creator on the platform. Users browse and subscribe at **`/bundles`**; admins create and manage bundles at `/admin/bundles`. A bundle holder automatically sees every creator's subscriber-only posts unlocked in the feed (pay-per-view items and live-show tickets remain separate one-off purchases). Bundle revenue is pooled — fair per-creator revenue-sharing based on engagement is a planned follow-up.

### Compliance hardening
- **Region blocking for adult content** — Adult (suggestive/explicit) content can now be withheld entirely in configured countries via `ADULT_BLOCKED_COUNTRIES`, enforced in both the feed and the media endpoint based on the request's country.
- **2257-style records on explicit posts** — When marking a post explicit, creators can now list everyone appearing (by @username) and attach a consent/release document; both are stored with the post's compliance record and surfaced to admins in the review queue (with performer count + "consent doc attached" indicators).
- **CSAM scanning hook** — Added the server-side integration seam and an internal scan endpoint that quarantines flagged media. Detection requires wiring a licensed provider (PhotoDNA/Thorn/Hive); until then, human moderation remains the safeguard.

---

## 3 June 2026 — Creator Content Platform: Ticketed Live Shows (M5)

### What's New
- **Live shows** — Creators can broadcast live video to their audience. Tap **Go live** (`/live/new`), set a title and an optional **ticket price**, and start streaming from your camera. Viewers browse currently-live shows at **`/live`**, buy a ticket through the crypto checkout if the show is paid (free shows join instantly), then watch in real time and **tip during the stream**. The host sees a live viewer count and can end the show anytime. Built on LiveKit (the same realtime tech already used for chat), with tickets and tips flowing through the existing payments + earnings system. Ships behind a new `USE_LIVE_SHOWS` flag (off by default).

---

## 3 June 2026 — Creator Content Platform: Paid DMs + Payout Automation (M3c)

### What's New
- **Pay-per-view direct messages** — Creators can send a **locked photo** in a DM with a price: tap the lock icon next to the photo button, set a price, and send. The recipient sees a tasteful "Locked photo" bubble with an **Unlock · CA$X** button; after paying, the photo reveals (and the creator's balance is credited like any other sale). Locked media is stored privately and only ever served through a short-lived, permission-checked link — it's never broadcast over the live chat connection, so it can't leak to someone who hasn't paid. The sender always sees their own content.
- **Automatic payout maturation** — Confirmed earnings now move from *pending* to *withdrawable* on a schedule (hourly), once the hold window passes — no manual step required (uses pg_cron).
- **Admin Payram health check** — A new admin-only diagnostic endpoint reports whether the Payram payment gateway is configured and reachable, to confirm the integration once the server is deployed.

---

## 3 June 2026 — Creator Content Platform: Age Gate & Compliance (M4)

### What's New
- **Age-gating and explicit-content moderation (required before launch)** — Put the safety rails in place for tiered adult content. **Viewers** only see suggestive/explicit posts if they're age-verified AND have switched on "Show adult content" in Privacy settings (the toggle is locked until age verification is done); everyone else — and anyone logged out — sees an SFW-only feed. This is enforced in two places so it can't be bypassed: the feed query and the secure media endpoint both re-check eligibility. **Creators** can't mark a post explicit unless they're age-verified, and must tick a consent attestation (everyone appearing is 18+ and has consented). **Explicit posts are held for review** — they stay hidden from the feed until an admin approves them in a new **Explicit content review** queue in the admin dashboard, backed by a 2257-style compliance record per post. (Follow-ups before scale: performer-ID/consent-document capture, automated CSAM scanning, and region-based SFW-only enforcement.)

---

## 3 June 2026 — Creator Content Platform: Premium Posts in the Feed (M3b)

### What's New
- **Pay-per-view & subscriber-only posts now work in the feed** — Creators can post premium content directly from the composer: choose **Public**, **Subscribers-only**, or **Pay-per-view** (with a price), plus a content rating (SFW / Suggestive / Explicit). Premium media uploads to a **private storage bucket** and never gets a public link. In the feed, locked posts show a tasteful blurred card with an **Unlock · CA$X** button (pay-per-view) or a **Subscribe to view** link; once a viewer subscribes or unlocks, the real media loads through a secure, expiring link that's re-checked on the server every time. Viewers' own posts and already-unlocked content show normally. (Paid direct-message attachments are coming in a follow-up.)

### What's New
- **Tips, pay-per-view DMs, and creator payouts (behind the feature flag)** — Built out the ways creators earn and cash out on the premium layer. **Tips:** fans can send a one-off tip (preset or custom amount) to any creator via a polished bottom-sheet. **Paid DMs:** messages can be locked behind a price, unlocked individually by the recipient. **Payouts:** every confirmed payment now credits the creator's balance, which moves from *pending* to *available* after a hold window (a safety buffer against refunds/chargebacks); creators can then request a withdrawal. A new **Earnings dashboard** (`/profile/earnings`) shows available / pending / lifetime totals and full payout history. All amounts remain server-authoritative, and the payment-confirmation logic stays fully idempotent. Backend: new `tips` and `payouts` tables, balance maturation + payout RPCs, and paid-DM columns on messages.

### Wired into the app
- **Paid subscribe** — the Subscribe button on a creator's profile now shows the monthly price (e.g. "Subscribe · CA$20/mo") and opens a PayRam checkout; it falls back to the old free subscribe when the creator layer is off. Also fixed a latent bug where the "already subscribed?" check looked at a column that doesn't exist, so the button could wrongly show as not-subscribed.
- **Send a tip** — a Tip button on creator profiles opens the tip sheet.
- **Cancel subscription** — subscribers can cancel from `/profile/subscriptions`; access continues until the paid period ends rather than cutting off immediately.
- **Earnings menu entry** — creators get an Earnings link in their profile menu.

---

## 3 June 2026 — Creator Content Platform: Payments (M2)

### What's New
- **Crypto payments wired up via Payram (still behind the feature flag)** — Built the first end-to-end money flow for the premium creator layer using **Payram**, a self-hosted, non-custodial crypto payment gateway (accepts USDT/USDC/BTC/ETH, 0% processing fees, no third-party KYC). A new payments engine records every transaction in a single source-of-truth `payments` table, opens a Payram checkout page, and listens for Payram's confirmation webhook to **activate subscriptions**, **record pay-per-view unlocks**, and **credit the creator's earnings balance** — all idempotently, so duplicate/retried webhooks can never double-charge or double-grant. Amounts are always calculated server-side from the database (never trusted from the browser). The processor sits behind a swappable interface, so a different gateway can be dropped in later without touching the rest of the app. Setup steps and env vars are documented in `docs/onlyfans-plan.md` and `.env.example`.

---

## 2 June 2026 — Creator Content Platform: Foundations (M1)

### What's New
- **Premium creator-content layer — foundations laid (behind a feature flag)** — Began building an OnlyFans-style premium content system on top of the existing feed/subscription infrastructure. This first milestone is infrastructure only, shipped dark behind the new `USE_CREATOR_CONTENT` flag (off by default), so nothing changes for users yet. It adds: a **private `premium-content` storage bucket** (paywalled media is never publicly readable), a **content rating field** (SFW / suggestive / explicit) on posts to power age-gating, a consumer **adult-content opt-in** setting, an **entitlement engine** (`lib/access.ts`) that is the single gate deciding who can view paid content, and a **secure media endpoint** (`/api/media/[postId]`) that hands out short-lived (60-second) signed links only to subscribers, buyers, or the creator. Reuses the existing subscriptions and pay-per-view (`content_unlocks`) tables rather than duplicating them. Full roadmap (Payram payments, paid DMs, tips, payouts, live shows, compliance) documented in `docs/onlyfans-plan.md`.

---

## 22 April 2026 — Free Listings Promo, KYC Onboarding Step, Credit Bug Fix

### What's New
- **All listings are now FREE (limited time launch promo)** — Switched from "first listing free" to "all listings free." Provider listing creation and relisting cost 0 credits across the app. Credits remain required only for premium placements (Bump and Star).
- **KYC verification reminder during signup** — Added a new step in the provider onboarding flow, surfaced right after the listing card, that explains the gold verified badge benefits and offers a one-tap CTA to start ID verification (or skip and verify later). Card now emphasizes that the check is **free**, takes **under 2 minutes**, replaces the usual photo-with-paper verification, and includes a privacy footnote: **we do NOT keep ANY verification data**.

### Improvements
- **Credit strings fully translated to French** — The Billing & Credits page, Packages page, and Provider Dashboard credit row are now fully localized. Previously English-only labels like "X credits left", "Buy More", "Your balance", "Credits Available", "Purchase History", "Best Value", "Expired/Active", and the Stripe payment notice now render in French when the FR locale is active. Dates in the credits area also follow the user's locale.
- **KYC / ID verification page fully translated to French** — The entire `/profile/verify` screen (header, hero title/body for all three states, "How it works" steps, benefits list, privacy note, and the "Verification usually takes under 2 minutes" badge) now renders in French when the FR locale is active. Previously every label on this page was hardcoded English regardless of locale.

### Bug Fixes
- **"Insufficient credits" error when bumping/starring with a non-zero balance** — Welcome credits and admin grants only updated the denormalized `profiles.post_credits_balance` without creating a backing row in the purchase ledger. The `deduct_post_credit` RPC now falls back to deducting from the denormalized balance when the ledger is empty, so the 100 welcome credits actually work.
- **Avatar/profile picture upload failures** — Uploads were silently getting stuck in three ways: (1) HEIC photos from iPhones crashed the compression step with no try/catch, leaving the UI spinning forever; (2) the storage path's file extension was derived from the original filename rather than the compressed file's MIME type, producing garbage extensions like `avatar.foo` for files with no extension; (3) the `avatars` storage `UPDATE` RLS policy was missing its `WITH CHECK` clause, which caused `upsert: true` to be rejected when overwriting an existing avatar. All three are fixed: compression now gracefully falls back to the original file on decode errors, uploads now use a timestamped filename (auto cache-busting, no upsert needed), and the RLS policy is now well-formed.
- **Persona KYC verification "Cannot access camera" error** — The site's `Permissions-Policy` header was set to `camera=()` and `microphone=()`, which disables those features in **all** frames including Persona's verification iframe. The user never even got the browser camera prompt — the request was blocked at the policy layer before reaching the OS. Switched both to `camera=*` / `microphone=*` so any frame may *request* access (the browser's user-permission prompt still gates actual access, so this doesn't weaken security).

---

## 31 March 2026 — UX Improvements, Infinite Scroll, Relist System

### What's New
- **Infinite scroll on Listings page** — Listings now load in pages of 20 with automatic loading as you scroll, replacing the previous 80-listing hard cap. Works with all filters and sort options.
- **Relist expired listings** — Expired listings now show a "Relist" banner with a one-tap button that reactivates the listing for another 24 hours (costs 1 credit). Backed by a new `relist_listing` RPC.
- **Explore text search** — The search bar on the Explore page now filters posts by username and caption in addition to city.
- **Upload draft saving** — Post type and caption are now saved to localStorage as you type, so you won't lose your work if you accidentally close the page.
- **Availability timezone selector** — The Availability settings page now includes a timezone dropdown (Americas, Europe, Asia, Pacific) shown alongside your weekly schedule.
- **"My Page" nav tab** — Providers now see a "My Page" tab in the bottom navigation that links directly to their public profile page.

### Improvements
- **10 free credits granted to all providers** — Every provider account received 10 credits for testing the listing and post system.
- **30 mock posts + 3 stories added** — Seed data spread across providers with staggered timestamps for testing infinite scroll and feed rendering.

---

## 31 March 2026 — Notification Fixes, Reviews Removed

### Bug Fixes
- **"Mark all as read" now clears the badge instantly** — Tapping "Mark all read" on the notifications page now immediately clears the unread count badge in the bottom navigation, without waiting for the next refresh.
- **Message request notifications now work** — When a client sends a message request, the provider now correctly receives a notification. Tapping the notification takes them to the Requests tab in Messages. (Previously blocked by a database constraint.)

### Changes
- **Reviews feature removed** — The entire reviews system has been removed from the platform. This includes review tabs on profiles, the rating display on the provider dashboard, the "Leave a Review" option on completed bookings, and review-related notifications. The platform is focused on messaging and direct contact between users.

---

## 31 March 2026 — Comment Moderation Fix, Post Deletion, Client Menu

### Bug Fixes
- **Comments now properly hidden until approved** — Comments on posts were appearing publicly before the provider approved them. Fixed across the post detail page, feed queries, and comment submission. Users now see a "Comment sent — visible once approved by the creator" message after commenting.
- **frankykas209 account corrected to client** — Was incorrectly set as a provider account.

### What's New
- **Providers can delete their own posts** — A three-dot menu now appears on your own posts in the feed, with a "Delete post" option that removes it immediately.
- **Client-specific profile menu** — Client accounts no longer see provider-only options like ID Verification and Billing in their profile menu. The menu is now tailored to each account type.

---

## 31 March 2026 — Real-Time Chat with Message Requests (GetStream)

### What's New
- **Message Request System** — Clients can now send a message request to a provider with a personal intro message. Providers see incoming requests in their inbox and can accept or reject them. Once accepted, a private real-time chat is created between both users.
- **Real-Time Chat (GetStream)** — All messaging is now powered by GetStream Chat, replacing the previous basic system. Messages appear instantly for both parties with no page refresh needed.
- **Two-Tab Inbox** — The messages page now has two tabs: "Conversations" (active chats) and "Requests" (pending message requests with accept/reject for providers, or sent request status for clients).
- **Smart Message Button** — The Message button on provider profiles now adapts to the request status: shows "Message" for new requests, "Pending" while waiting for approval, and "Chat" once accepted.
- **Messages Tab for All Users** — Both clients and providers now have a Messages tab in the bottom navigation with unread message badges powered by real-time events.

### Improvements
- **Unread Badges Update in Real-Time** — Message notification badges now update instantly when new messages arrive, replacing the old 30-second polling system.
- **Request Notifications** — Providers get notified when someone sends a message request. Clients get notified when their request is accepted.
- **Duplicate Request Prevention** — Users can only send one request per provider. If a previous request was declined, they can try again.

---

## 31 March 2026 — Navigation Redesign, Profile Improvements & Bug Fixes

### What's New
- **Smarter Navigation for Clients** — Clients now see a clean 4-tab menu: Home, Explore, Alerts, and Profile. The messaging tab has been moved inside the profile area to keep things simple. Providers keep their full navigation with quick access to create content and messages.
- **Public Profiles Show the Right Info** — When someone visits a client's profile, they only see what's relevant (posts and bio). Provider-specific sections like listings and reviews are hidden for non-providers.
- **Services & Rates on Provider Profiles** — Visitors can now see a provider's hourly rate and service categories displayed clearly on their profile page.
- **Report & Flag Any Content** — Users can report profiles, listings, posts, or messages they find inappropriate. Choose from categories like spam, fake profile, harassment, or scam, with optional details. The system prevents duplicate reports and everything goes into an admin review queue.

### Improvements
- **"Clear Filters" on Empty Search Results** — If a search returns no listings, users can now reset all filters with one tap instead of manually clearing each one.
- **Consistent Branding** — All action buttons across the settings pages now use the signature amber/gold colour for a polished, unified look.
- **Comment Moderation Handles Large Queues** — Providers with 50+ pending comments can now load them in batches instead of everything at once.
- **Message Thread Options** — The three-dot menu in conversations now works, giving quick access to view the other person's profile or report them.

### Bug Fixes
- **Public profiles no longer show a 404 error** — Visiting someone's profile (e.g. /u/sophia.belle) was broken; now works reliably.
- **"View on Profile" goes to the right place** — After publishing a post, tapping "View on Profile" now takes you to your public profile instead of the settings page.
- **Saved Listings consolidated** — "Favourites" and "Liked Posts" have been merged into a single "Saved Listings" section to avoid confusion.

---

## 30 March 2026 — Social Feed, Stories & Content Credits

### What's New
- **Social Feed (Instagram-style)** — A scrollable feed where users can see posts from providers they follow, with likes, comments, and sharing built in.
- **Stories** — Providers can share 24-hour temporary stories that appear at the top of the feed. Unseen stories are highlighted with a ring indicator so users know what's new.
- **Content Credit Packages** — Providers can purchase credit packs to publish posts. Five tiers available from single credits to bulk packs, all handled securely through Stripe.
- **Post & Story Creation** — Providers choose between creating a permanent post (costs 1 credit) or a free story (disappears after 24 hours). Simple toggle on the upload screen.

### Improvements
- **Feed Performance** — The feed loads faster using optimised database queries with comments embedded directly.
- **Credit Balance Updates Instantly** — After publishing, the credit count updates right away without needing to refresh the page.

---

## 30 March 2026 — Onboarding, Messaging, Password Reset & UX Polish

### What's New
- **First-Time User Onboarding** — New users are guided through a 3-step setup: choose their role (client or provider), fill in their profile details, and get a welcome confirmation. No one falls through without completing setup.
- **Direct Messaging from Profiles & Listings** — Clients can message providers directly from their profile or listing page with a clean compose screen and instant confirmation.
- **WhatsApp, Telegram & Phone Contact** — Providers can add their contact details in profile settings. These show up as tap-to-contact buttons on their profile and listings.
- **Password Reset** — Users who forget their password can now reset it via email directly from the sign-in page. Simple two-step flow: enter email, then set a new password.
- **Subscribe to Providers** — If a provider offers a subscription tier, a gold "Subscribe" button appears on their profile so fans can subscribe with one tap.
- **Provider Dashboard** — A new home screen for providers showing their key stats at a glance: views, likes, rating, live listings, and post count. Plus quick shortcuts to create content, manage listings, moderate comments, and more.
- **Credit Balance on Dashboard** — Providers can see how many posting credits they have left with a quick link to buy more.
- **Unread Message Badges** — Unread message counts now appear as badges on the navigation and dashboard so nothing gets missed.

### Improvements
- **"Coming Soon" Placeholders Removed** — All non-functional placeholder buttons have been replaced with real features or removed entirely. The app now only shows things that actually work.
- **Billing Page Redesigned** — Shows real credit balance, purchase history, and usage breakdown instead of placeholder data.
- **Profile Edits Apply Instantly** — Changes to your profile (name, bio, avatar) now reflect everywhere immediately without needing to refresh.
- **Age & Height Validation** — Profile editing now checks that age is between 18-99 and height is within a realistic range before saving.
- **Share Button Confirmation** — Copying a profile link now shows a brief "Link copied" message so users know it worked.
- **Comment Approval System** — Comments on posts are held for the provider to approve before they become visible, giving providers full control over what appears on their content.

---

## 29 March 2026 — Listing Expiry, Bump Credits & Comment Moderation

### What's New
- **Listings Now Expire** — Listings are live for 24 hours by default. A countdown timer shows how much time is left, and expired listings are automatically hidden from public browsing.
- **Bump Credits** — Posting or refreshing a listing costs 1 credit. Providers can see their balance and buy more credits when they run low. A low-cost single credit option is available for those who want to try it out.
- **Comment Moderation** — Providers have a dedicated approval queue where they can approve or reject comments on their posts one by one, or approve everything at once.

### Improvements
- **Updated Credit Pricing** — Five tiers: Single (1 credit), Starter (5 credits), Popular (15 credits), Pro (40 credits), and VIP (100 credits) with clear value progression.
- **Comment Feedback** — When someone leaves a comment, they're told it will appear once the provider approves it, so there's no confusion.

---

## 28 March 2026 — Upload Flow & Payment Integration

### What's New
- **Post & Story Upload** — Upload screen with a simple toggle between creating a permanent post or a temporary story.
- **Credit Purchase Flow** — Browse available credit packs, see which offers the best value, and purchase securely via Stripe. Purchase history and remaining balance are tracked automatically.
- **Bookings System (Hidden)** — A full bookings/enquiry system has been built but is currently switched off. It can be turned on when the platform is ready for that feature.

### Improvements
- **Cleaner Interface** — Booking-related UI elements are hidden throughout the app until the feature is activated, keeping the experience focused on what's live.
