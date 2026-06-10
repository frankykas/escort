import type { CapacitorConfig } from "@capacitor/cli";

// ─────────────────────────────────────────────────────────────────────────────
// Capacitor config — wraps the deployed Next.js app inside a native Android shell.
//
// The app loads from `server.url` (your Vercel deployment) so users always get
// the latest server-rendered, Supabase-connected experience without re-shipping
// the APK. The local `webDir` only contains a tiny fallback splash screen shown
// before the WebView connects.
//
// → Update `server.url` to your real production URL before building the APK.
// ─────────────────────────────────────────────────────────────────────────────

const config: CapacitorConfig = {
  appId: "com.cleopatra.app",
  appName: "Cleopatra",
  webDir: "capacitor-fallback",

  server: {
    // Production Vercel URL — replace with your own domain.
    url: "https://cleopatre.vercel.app/",
    // Treat the remote URL as same-origin for cookies / Supabase auth.
    cleartext: false,
    androidScheme: "https",
  },

  android: {
    // Allow mixed content only if you load anything over http (rare).
    allowMixedContent: false,
  },

  plugins: {
    // Status bar (top) — overlays the WebView so the page can paint behind it,
    // and uses dark icons because our cotton-candy background is light.
    StatusBar: {
      overlaysWebView: true,
      style: "DARK",
      backgroundColor: "#00000000",
    },
    // Navigation bar (bottom) — community plugin, gives us full edge-to-edge
    // mode and lets us tint the gesture/back-home bar to match the app.
    EdgeToEdge: {
      backgroundColor: "#00000000",
    },
  },
};

export default config;
