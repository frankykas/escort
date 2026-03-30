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
