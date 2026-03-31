# Cleopatra — What's New

A summary of everything we've built and improved, newest first.

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
