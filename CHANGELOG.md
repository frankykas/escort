# Cleopatra — Feature Changelog

A running log of all features, fixes, and improvements shipped. Newest entries first.

---

## 2026-03-30 — Social Feed Overhaul, Stories System, Posting Packages

### New Features
- **Complete Social Feed System** — Instagram-style feed with embedded comments, likes, shares, and real-time engagement tracking
- **Stories System (Full Implementation)** — 24-hour ephemeral stories with view tracking, unseen indicators, and tap-through navigation
- **Posting Packages & Credit System** — Revenue engine with Stripe Checkout integration. Providers purchase post credits (Starter 10 credits, Popular 30 credits, Pro 75 credits, Unlimited 200 credits)
- **Enhanced Post Creation** — Support for both posts (credit-based, permanent) and stories (free, 24h expiry) with proper credit checking and validation
- **Real Stories Bar** — Stories bar now shows actual stories from database with unseen ring indicators, not just fake avatars
- **Comments Visible on Feed** — Latest 3 comments embedded directly in feed posts with "View all X comments" links
- **Advanced Database Functions** — `get_feed_posts()` and `get_active_stories()` RPC functions for optimized queries
- **Post Type System** — Distinguishes between permanent feed posts and ephemeral stories with different behaviors

### Improvements
- **Feed Performance** — Switched from raw queries to optimized database functions with embedded comment data
- **Credit Balance Real-time Updates** — Local credit count decrements immediately after successful post publishing
- **Story Expiration Logic** — Stories automatically expire after 24 hours, posts get far-future expiry for permanence
- **Type Safety** — Updated all TypeScript interfaces to match new database schema with proper property names
- **Suspense Boundaries** — Fixed Next.js build errors by properly wrapping useSearchParams in Suspense components

### Bug Fixes
- **Fixed: "expires_at violates not-null constraint"** — Posts now get proper expiry timestamps (2099 for posts, 24h for stories)
- **Fixed: TypeScript compilation errors** — Updated all components to use new FeedPostData structure with provider_* properties
- **Fixed: useSearchParams Suspense error** — Wrapped packages page in proper Suspense boundary

### Backend / Migrations
- **Migration 015** — Complete stories system, posting packages, analytics, and admin controls
- **API Endpoints** — `/api/posts`, `/api/stories`, `/api/packages`, `/api/packages/checkout` with full Stripe integration
- **Database Functions** — `get_feed_posts()`, `get_active_stories()`, `deduct_post_credit()` for optimized operations

---

## 2026-03-30 — Onboarding, Messaging, Reports, Password Reset, UX Polish

### New Features
- **Onboarding Flow** — New users are redirected to `/onboarding` after signup. Three-step flow: role selection (client vs provider) → profile setup (username, avatar, bio, city, categories for providers) → confirmation. Server-side redirect from home page for users who haven't completed onboarding.
- **In-App Messaging from Profiles & Listings** — Clients can now message providers directly from their profile or listing page. Clean compose sheet with "Message sent" confirmation and "View Conversation" shortcut.
- **WhatsApp, Telegram & Phone Contact Links** — Providers can add their WhatsApp number, Telegram handle, and phone number in Profile Edit. These appear as contact options on their public profile and listings with deep links.
- **Password Reset Flow** — "Forgot password?" link on sign-in page. Sends reset email via Supabase, then redirects to update-password page where the user sets a new password.
- **Report / Flag System** — Users can report profiles, listings, posts, or messages. Report modal with 8 reason categories (spam, fake profile, harassment, underage, scam, etc.) and optional details. Prevents duplicate reports. Reports stored with admin resolution workflow (pending → reviewed → actioned/dismissed).
- **Subscribe Button on Public Profiles** — If a provider has set up a subscription tier, a gold "Subscribe" button appears on their public profile. Tracks active subscription state.
- **Credit Balance on Dashboard** — Providers see their credit balance front and center with a "Buy More" CTA linking to the packages page.
- **Pending Comments Badge** — Dashboard quick actions now show a badge count for comments awaiting approval.
- **Unread Messages Badge** — Dashboard messages shortcut shows unread count with a badge.
- **Mock Content for sophia.belle** — 3 feed posts and 1 active story added for demo/testing purposes.

### Improvements
- **Messages Tab in Bottom Nav** — Both client and provider navs now include a Messages tab (MessageSquare icon) linking to `/messages` inbox.
- **Coming Soon UI Removed** — Eliminated all non-functional "Coming Soon" buttons and disabled elements: verification CTA (now shows "Launching soon" info card), Stripe payouts button (removed), blocked users row (removed from privacy), push notifications toggle (removed from notification settings).
- **Provider Dashboard Redesigned** — Replaced booking-centric layout with content-creator stats: Views, Likes, Rating, Live Listings, Posts. Added 6 quick actions (Create, Listings, Comments, Availability, View Profile, Buy Credits). Empty state nudge for new providers.
- **Billing Page Overhauled** — Removed fake CA$0 earnings placeholders. Now shows real credit balance, purchase history with remaining/used counts, and credit usage explainer.
- **Edit Profile Button Works** — Was disabled, now links to `/profile/edit`.
- **Message Button Works** — Was disabled on public profiles, now opens the conversation thread.
- **BottomNav Hidden on Onboarding** — Clean full-screen onboarding experience without nav clutter.
- **Comment Button Now Works in Explore Feed** — Tapping the comment icon on a feed card now navigates to the full post detail page. Comment count is also clickable.
- **Service Categories & Rate on Public Profile** — The About tab now displays service categories as chips and the provider's hourly rate. Previously these were saved but never shown.
- **Share Button Shows "Link Copied" Toast** — Copying a profile link to clipboard now shows a brief confirmation instead of silently copying.
- **Unread Messages Badge in BottomNav** — Messages tab now shows a red badge with unread count, matching the notifications badge. Polls every 30 seconds.
- **ProfileContext Synced After Profile Edit** — Editing your profile now immediately updates the nav and dashboard without requiring a page refresh.
- **Credit Balance Updates After Publishing** — Post credit count now decrements locally after a successful publish instead of showing stale balance.
- **Age & Height Validation** — Profile edit now validates age (18–99) and height (140–220 cm) before saving, with error toast on invalid input.

### Bug Fixes
- **Fixed: "expires_at violates not-null constraint"** — Publishing posts or stories failed because `expires_at` was sent as `null` for regular posts. Posts now get a far-future expiry (permanent), stories get 24h.

### Backend / Migrations
- **Migration 020** — Added `contact_whatsapp`, `contact_telegram`, and `contact_phone` columns to profiles table.
- **Migration 021** — Seed data: 3 posts + 1 story for sophia.belle.
- **Migration 022** — Added `onboarding_completed` boolean to profiles (existing users auto-marked as complete).
- **Migration 023** — Reports table with RLS, reason categories, unique-per-user constraint, and admin resolution fields.

---

## 2026-03-29 — Listing Expiry, Credits, Comment Moderation

### New Features
- **Listing Expiry System** — Listings are now temporary (24h default). Timer badges show "12h 30m left" or "Expired" on each listing. Expired listings are dimmed and hidden from public browse.
- **Credit-Per-Listing** — Creating a listing costs 1 credit. Credit balance shown on listings page with "Buy Credits" link. Create button disabled when no credits.
- **Single Bump Package** — New $2.99 single-credit package for providers who want to try before committing to a bundle.
- **Comment Moderation System** — Instagram-style approval queue. Comments are hidden by default until the provider approves them. Dedicated moderation page at `/profile/comments` with Approve/Reject per comment and "Approve All" bulk action.
- **"Create" Tab for Providers** — Replaced the Bookings tab in the bottom nav with a "Create" shortcut (PlusCircle icon) linking to post/story creation.

### Improvements
- **Updated Posting Packages** — Rebranded as "Bump Credits" with new pricing: Single ($2.99/1cr), Starter ($9.99/5cr), Popular ($24.99/15cr), Pro ($49.99/40cr), VIP ($99.99/100cr).
- **Comment Sent Feedback** — When a user comments on a post, they now see "Comment sent — visible once approved by the creator" instead of the comment appearing immediately.

### Bug Fixes
- **Fixed: RLS violation on post creation** — Server client was using anon key (no auth session). Changed to use `SUPABASE_SERVICE_ROLE_KEY` for trusted server-side operations.

### Backend / Migrations
- **Migration 017** — Disabled booking notification triggers.
- **Migration 018** — Comment moderation system (is_approved, is_rejected, moderated_at columns, updated get_feed_posts RPC, moderation RPCs).
- **Migration 019** — Listing expiry + credit deduction system (expires_at column, updated RLS policies, create_listing_with_credit RPC).

---

## 2026-03-28 — Bookings Hidden, Upload Flow, Packages

### New Features
- **Post/Story Toggle on Upload** — Upload page now supports creating either a feed post or a story with a tab toggle. Stories are free (24h expiry), posts cost 1 credit when posting packages are enabled.
- **Posting Packages Purchase Page** — Browse available credit packages, see "BEST VALUE" badge, purchase via Stripe Checkout, view purchase history and credit balance.
- **Stripe Checkout Integration** — Full payment flow: package selection → Stripe Checkout → webhook → credit recording.
- **USE_BOOKINGS Feature Flag** — Bookings system hidden behind feature flag (disabled by default). All booking UI, notifications, and tabs gracefully hidden without deleting code.

### Improvements
- **Notification Filtering** — Booking-related notifications hidden when USE_BOOKINGS is disabled.
- **Provider Profile** — Completed bookings badge hidden when USE_BOOKINGS is disabled.

### Backend / Migrations
- **Migration 015** — Posting packages, stories system, geo search, post cooldown, view tracking, admin controls, country-level feed.
- **Migration 016** — Notifications system.
