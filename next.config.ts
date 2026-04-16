import type { NextConfig } from "next";

// ─── Security headers ────────────────────────────────────────────────────────
// Defense-in-depth headers applied to every response. CSP is intentionally
// permissive on inline scripts/styles because Next.js + React Compiler emit
// hydration-time inline content. Locking that down would require a nonce-based
// middleware setup; we can revisit pre-launch if needed.
//
// Third-party origins allowlisted:
//   • Supabase (REST + Storage + Realtime WebSocket)
//   • LiveKit (WebSocket data-channel transport for chat)
//   • Persona (script + iframe for ID verification)
//   • Unsplash (seed avatars — remove before public launch)

const cspDirectives = [
  "default-src 'self'",
  // Scripts: allow self + inline (Next.js hydration) + Persona SDK.
  // 'unsafe-eval' is required by the Persona SDK and some Next.js dev paths.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.withpersona.com",
  // Styles: Tailwind compiles to a single sheet but framer-motion + emotion-style
  // libs inject inline style tags at runtime, so 'unsafe-inline' is required.
  "style-src 'self' 'unsafe-inline'",
  // Images: allow any HTTPS source so user-uploaded media (Supabase Storage,
  // remote avatars, og: previews) just work. data: + blob: cover canvas exports.
  "img-src 'self' data: blob: https:",
  // Media (audio/video): same reasoning as images for stories.
  "media-src 'self' blob: https://*.supabase.co",
  // Fonts: self only (we don't load Google Fonts).
  "font-src 'self' data:",
  // Network connections: REST/WebSocket destinations the app actually uses.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co wss://*.livekit.cloud https://*.withpersona.com",
  // Iframes we embed (Persona's verification flow opens inside an iframe).
  "frame-src https://*.withpersona.com",
  // Workers (Web Push service worker is same-origin).
  "worker-src 'self' blob:",
  // Disallow being framed by anyone else (clickjacking defense).
  "frame-ancestors 'none'",
  // Block legacy plugins.
  "object-src 'none'",
  // Forms can only post to same-origin.
  "form-action 'self'",
  // Pin <base> to same-origin (defense against base-tag injection).
  "base-uri 'self'",
  // Force https for any subresources that slipped through as http.
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // HTTPS for two years, include subdomains, eligible for browser preload list.
  // Only kicks in over HTTPS — won't break local dev on http://localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Belt-and-braces clickjacking defense alongside frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Don't let browsers MIME-sniff a text/plain into a script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin (not the full URL) on cross-site navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser APIs to same-origin only.
  // 'self' for geolocation because we use it for nearby-provider search.
  // Camera/mic disabled at the top level (Persona requests them inside its
  // own iframe on its own origin, so this doesn't break verification).
  {
    key: "Permissions-Policy",
    value: [
      "geolocation=(self)",
      "camera=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "gyroscope=()",
      "accelerometer=()",
      "interest-cohort=()",
    ].join(", "),
  },
  // Modern replacement for X-XSS-Protection — opt into cross-origin isolation
  // for resources, helps prevent Spectre-style cross-origin reads.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // The CSP itself.
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "mcnrnwghzjexnatjilrg.supabase.co" },
    ],
    // Serve modern formats when the browser supports them
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 30 days at the edge
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
