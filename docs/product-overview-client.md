# Cleopatra — Product Overview

*A walkthrough of the platform, the bump promotion system, the credit
economy, and the design choices behind the interface.*

---

## 1. What is Cleopatra?

Cleopatra is a **premium classifieds and discovery platform for adult
companionship services**. It gives independent providers a polished home for
their listings and gives clients a fast, mobile-first way to browse, follow,
and contact them.

It blends two experiences in a single product:

- **Classifieds** — structured listings with price, duration, perks, photos,
  city, and a contact flow. The traditional "post an ad / browse ads" model.
- **Social discovery** — a feed of posts and 24h stories from providers, much
  like Instagram, so clients can follow providers they like and see new
  content as it goes live.

Both modes are toggled by feature flags so the platform can A/B test or roll
out either model independently.

The product is mobile-first by design — over 90% of expected traffic is on
phones, so every page is laid out for one-thumb operation, with primary
actions reachable in the bottom third of the screen.

---

## 2. The Two Roles

| Role | What they do | What they see |
|------|--------------|---------------|
| **Provider** (escort) | Posts listings, uploads stories/posts, accepts bookings, replies to messages, buys credits to promote. | Dashboard, Create button, Inbox, Notifications, Profile. |
| **Client** | Browses, follows, saves favourites, sends message requests, books. | Home/Explore, Search, Inbox, Notifications, Profile. |

The two roles share the same shell — the same bottom navigation, the same
visual language — but each tab is wired to role-appropriate screens. A
provider's "Create" button opens the listing composer; a client never sees
that button.

---

## 3. The Bump System — How Listings Get Promoted

**The problem.** New listings are competing with hundreds of others. Without
a way to surface the best, the feed becomes a flat wall of content and
providers have no way to invest in their visibility.

**The solution: a three-tier bump system.** Providers spend credits to
"bump" a listing into one or more discovery surfaces for **24 hours**. Each
tier unlocks an additional surface. The higher the tier, the more credits
and the more reach.

### The three tiers

| Tier | Cost | Lasts | Surfaces |
|------|------|-------|----------|
| **Tier 1 — Basic Bump** | 1 credit | 24 hours | Explore page **Stories Bar** |
| **Tier 2 — Premium Bump** | 2 credits | 24 hours | Stories Bar **+ Similar Profiles** carousel |
| **Tier 3 — Maximum Exposure** | 3 credits | 24 hours | Stories Bar **+ Similar Profiles + pinned in the main Explore feed** |

Each surface is a separate piece of real estate inside the app:

- **Stories Bar** is the horizontal row of avatars at the top of the
  Explore page. Bumped providers appear there alongside organic stories.
- **Similar Profiles** is the carousel that shows up when a client is
  viewing another provider's profile — Tier 2+ providers appear in the
  "you might also like" rail of nearby competitors' pages.
- **Explore Feed** is the main scrolling content river. Tier 3 promoted
  posts are inserted **once every five organic posts**, geo-filtered to the
  client's city, and randomized fairly among competing bumps so no single
  provider dominates.

### Rules and guardrails

- **Geo-targeting.** Bumps only show to clients in the same city as the
  provider. A Montreal provider never burns budget showing to a Toronto
  user.
- **One active bump per listing.** A listing already on a bump can't be
  bumped again until the current one expires. This prevents stacking.
- **Atomic credit spending.** If a provider only has 2 credits and tries to
  buy a Tier 3 bump, the system stops them up front rather than charging
  partially. The check happens before the bump record is created.
- **Refund-on-failure.** If credit deduction succeeds but the bump record
  fails to create, credits are refunded automatically.
- **Fair rotation.** Tier 3 promoted posts are fetched in a randomized
  order (`ORDER BY random()` at query time) so a single provider can't
  monopolize the feed even if they bump aggressively.
- **Auto-cleanup.** A scheduled job runs every 10 minutes to flip
  `is_active = false` on bumps that have expired, and another job 15
  minutes before expiry sends the provider a "your bump is about to
  expire" notification so they can re-bump if they want.

### What the provider sees

When a provider taps **Bump** on one of their listings, a bottom sheet
slides up showing the three tiers side by side. Each tier card shows:

- The tier name and icon
- The credit cost
- A plain-English description of *which* surfaces the listing will appear in
- A "popular" badge on Tier 2 (it's the sweet spot — most providers buy it)
- A grayed-out state if they don't have enough credits, with a clear
  "Buy more credits" link

This design pattern — *bottom sheet, three large cards, clear pricing,
clear value laddering* — is borrowed from how successful subscription apps
like Spotify and YouTube Premium present their tiers. It makes the upgrade
path feel obvious without being pushy.

---

## 4. The Credit Economy

Cleopatra runs on a **credit-based currency** rather than per-action
billing. This is deliberate: it lets providers pre-purchase a budget,
removes friction at the point of every action, and makes the app feel
generous (the first listing is free; small actions cost just one credit).

### What credits are spent on

| Action | Cost |
|--------|------|
| **First listing ever** | **Free** — every new provider gets one listing on the house |
| Additional listing (24h) | 1 credit |
| Relisting an expired listing | 1 credit |
| Creating a feed post | 1 credit |
| Bumping a listing (Tier 1 / 2 / 3) | 1 / 2 / 3 credits |
| Stories | **Free** (capped at 10/day per provider) |

The economy is intentionally tilted to reward engagement: stories cost
nothing because they drive daily active use, but durable assets (listings,
bumps) cost real credits because they consume real screen real estate.

### How credits are purchased

Credits are sold in **packages** through Stripe Checkout. Each package
includes a fixed credit grant and a validity window — credits expire if
unused, which keeps the economy healthy and gives providers a gentle nudge
to stay active.

| Package | Credits | Price | Validity |
|---------|---------|-------|----------|
| **Starter** | 10 | £39.99 | 30 days |
| **Popular** | 30 | £99.99 | 30 days |
| **Pro** | 75 | £199.99 | 60 days |
| **Unlimited** | 200 | £399.99 | 90 days |

Larger packages have a clearly better per-credit rate, encouraging upfront
commitment and reducing transaction overhead on Stripe's side. Prices are
stored in pence (integers) in the database — never floats — and formatted
on display.

### How credits are deducted (FIFO)

Credits are deducted on a **first-in-first-out** basis. When a provider
spends, the system pulls from the oldest non-expired purchase first. This
means credits closest to their expiry get used up before fresher ones,
which is fairer to the provider and simpler to reason about than a flat
balance.

Internally, every spend goes through a single SQL function
(`deduct_post_credit`) that runs in a transaction, so the balance can never
go negative and there are no race conditions if a provider double-taps a
button.

### What the provider sees

The **Billing & Credits** page is the home of the credit economy. It shows:

1. A large **credit balance hero** at the top — the number is the most
   important thing on the page, so it's typeset at 36px and centered.
2. Two stat cards: **credits purchased** (lifetime) and **credits used**
   (lifetime) so the provider gets a sense of their investment vs. activity.
3. A **"Credits are used for"** section listing every spendable action with
   the first-listing-free rule highlighted in amber.
4. A **"Promote your listings"** section with the three bump tiers, colour
   coded (sky-blue / violet / amber) so they map visually to the bump
   drawer they'll see later.
5. A **Purchase History** list showing each package bought, when, how many
   credits remain in it, and whether it's still active or expired.

The whole page is a single scroll, no tabs, no nested navigation — the
provider can see *everything* about their billing posture in one glance.

---

## 5. Visual Design and Layout — Why It Looks the Way It Does

### The brand

- **Colour palette.** A near-black base (`zinc-950`) with **amber-400** as
  the single accent. Amber was chosen because it reads as warm, premium and
  expensive — it signals luxury without screaming gold. Secondary tier
  colours (sky for Tier 1, violet for Tier 2, amber for Tier 3) reinforce
  the value ladder.
- **Typography.** Geist Sans for the UI, tight letter spacing, generous
  line-height. Bold weights are used sparingly, almost only for prices and
  section headers, so they actually feel bold when they appear.
- **Imagery.** Photos are treated as the hero. Cards use minimal chrome
  around images so the provider's content sells itself.
- **Motion.** Framer Motion handles every meaningful transition — drawers
  slide up, modals fade in with a slight scale, cards animate on tap. This
  costs a few KB but transforms the *feel* of the app from "website" into
  "native app."

### The layout grid

Every screen follows the same skeleton:

```
┌─────────────────────────────────┐
│  Sticky header (back, title)    │
├─────────────────────────────────┤
│                                 │
│  Scrollable content             │
│  (max-width clamped on tablet+) │
│                                 │
│                                 │
├─────────────────────────────────┤
│  Bottom navigation (5 tabs)     │
└─────────────────────────────────┘
```

This is the **app shell pattern** — the header and bottom nav are fixed,
the middle scrolls. It's the layout users have been trained on by
Instagram, X, Threads, and TikTok, so there's zero learning curve.

### Key interaction patterns

- **Bottom sheets, not modals.** Anything that requires user input (bump
  selection, message compose, filters) opens as a bottom sheet that slides
  up from below. On mobile this is far more thumb-reachable than a centred
  modal and feels native to iOS/Android.
- **One primary action per screen.** Every screen has a single, clearly
  styled primary button (filled amber, bold black text). Secondary actions
  are de-emphasised (ghost buttons, low-contrast text). This eliminates
  decision paralysis.
- **Sticky headers with backdrop blur.** The header on every screen is
  semi-transparent with `backdrop-blur-xl`, so content scrolls *under* it
  rather than disappearing. It's a small detail that makes the app feel
  expensive.
- **Progressive disclosure.** Filters, advanced settings, and rarely-used
  features live behind drawers and dropdowns. The default view is always
  the simplest possible version.

### Why mobile-first is non-negotiable

Adult marketplaces are overwhelmingly browsed on phones, often in private
moments where a desktop isn't available. Cleopatra's CSS breakpoints start
at 360px wide and scale up — the desktop view is technically a centred
mobile column with extra margin, not a separate layout. This means there's
**one design**, not two, which keeps engineering velocity high and ensures
the experience feels consistent regardless of device.

---

## 6. Discovery Surfaces — Where Clients Spend Their Time

### Home / Explore
The default landing screen. A vertical feed of provider posts, infinite
scroll, with the **Stories Bar** pinned at the top. Tier 1+ bumps appear in
the Stories Bar; Tier 3 bumps are interleaved into the feed itself. Users
filter by city or browse globally.

### Profile pages
Every provider gets a public profile at `/u/[username]`. Above the fold:
avatar, name, verification badge, location, headline. Below: their listings
in a horizontal scroll, their stories, their public posts. At the bottom of
the profile, the **Similar Profiles** carousel shows other nearby providers
— this is where Tier 2+ bumps appear.

### Listing detail
Each listing has its own page (`/listings/[id]`) with a hero image,
provider card, perks chips, logistics block (duration, rate, location),
"other listings from this provider," an enquire bar at the bottom, and a
report button. This page is linked from the Explore feed, the Stories Bar,
the Similar Profiles carousel, and the provider's own profile — all roads
lead here.

### Messages
A real-time inbox split into **Conversations** (active threads) and
**Requests** (pending introductions clients have sent). Providers see
incoming requests with the client's intro message and accept or reject
them. Once accepted, the conversation moves to the main thread list and
real-time messaging takes over.

### Notifications
A unified notification feed for new followers, new messages, message
requests, post likes, post comments, and bump-expiring reminders. Each
notification routes to the relevant screen with one tap.

---

## 7. The Verification Layer

Trust is the most important currency in this category, so Cleopatra has a
**dedicated identity verification flow** powered by Persona. Providers
upload a government ID and a selfie; if the documents match, they're
auto-approved and earn a **gold checkmark badge** that displays on every
surface their content appears on (profile, posts, listings, stories).
Edge cases get queued for manual review by an admin.

A verified provider visibly outranks an unverified one in client trust,
which creates a natural incentive to complete the flow.

---

## 8. Admin Tooling

A super-admin dashboard at `/admin` gives the platform owner control over:

- **Users** — search, suspend posting, view activity, hard delete
- **Listings & posts** — hide, delete, audit
- **Reports** — review flagged content from users
- **Verifications** — approve / reject pending Persona reviews
- **Feature flags** — toggle social feed mode, posting packages, geo feed,
  bookings, and more on/off in production without a redeploy
- **Stats** — credit sales, active providers, pending verifications

Everything an operator needs to keep the platform clean and the economy
healthy is in one place.

---

## 9. What's Next

Below the line, the platform also has:

- **Push notifications** (Web Push, opt-in) so clients and providers get
  pinged the moment something happens
- **Onboarding spotlight tour** that runs on first sign-in, dimming the
  rest of the UI and highlighting one element at a time
- **Multi-language** support (English / French) wired through every string
- **Image compression** on upload (WebP, scaled to fit) so images load
  fast on poor connections
- **Cron-based housekeeping** for expired listings, expired bumps, expired
  credit purchases, and stale message threads

Cleopatra is a complete, production-grade platform — every screen has been
designed, built, and integrated. The bump and credit systems described
above are the engine of the business model: they turn discovery into
revenue without ever asking the client to pay for anything.
