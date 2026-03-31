# Cleopatra — What's New

A summary of everything we've built and improved, newest first.

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
