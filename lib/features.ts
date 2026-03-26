export const USE_SOCIAL_FEED =
  process.env.NEXT_PUBLIC_USE_SOCIAL_FEED === "true";

// Dev bypass: skip the verified-provider check on the + button.
// Set NEXT_PUBLIC_DEV_MODE=true in .env.local to enable.
export const DEV_SHOW_POST_BUTTON =
  process.env.NEXT_PUBLIC_DEV_MODE === "true";
