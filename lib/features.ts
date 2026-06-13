export const USE_SOCIAL_FEED =
  process.env.NEXT_PUBLIC_USE_SOCIAL_FEED === "true";

// Dev bypass: skip the verified-provider check on the + button.
// Set NEXT_PUBLIC_DEV_MODE=true in .env.local to enable.
export const DEV_SHOW_POST_BUTTON =
  process.env.NEXT_PUBLIC_DEV_MODE === "true";

// Posting packages: when enabled, providers must have post credits to create feed posts.
// Stories remain free regardless of this flag.
export const USE_POSTING_PACKAGES =
  process.env.NEXT_PUBLIC_USE_POSTING_PACKAGES === "true";

// Geo feed: when enabled, the explore page shows radius-based proximity filtering.
export const USE_GEO_FEED =
  process.env.NEXT_PUBLIC_USE_GEO_FEED === "true";

// Post cooldown: when enabled, enforces minimum time between feed posts.
export const USE_POST_COOLDOWN =
  process.env.NEXT_PUBLIC_USE_POST_COOLDOWN === "true";

// Bookings: when enabled, shows the booking/enquiry system.
// Disabled by default — the platform is a classifieds marketplace, not a booking intermediary.
export const USE_BOOKINGS =
  process.env.NEXT_PUBLIC_USE_BOOKINGS === "true";

// Creator content: when enabled, surfaces the premium creator-content layer
// (paywalled posts, PPV, paid DMs, tips, creator payouts). Gated content is
// served via signed URLs from the private premium-content bucket. Disabled by
// default — ships dark so it can be A/B tested before launch.
export const USE_CREATOR_CONTENT =
  process.env.NEXT_PUBLIC_USE_CREATOR_CONTENT === "true";

// Live shows: ticketed LiveKit A/V broadcasts by creators, with in-stream tips.
// Depends on the creator-content layer; ships dark by default.
export const USE_LIVE_SHOWS =
  process.env.NEXT_PUBLIC_USE_LIVE_SHOWS === "true";
