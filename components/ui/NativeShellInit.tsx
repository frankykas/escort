"use client";

import { useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// NativeShellInit
//
// On Android (Capacitor), enables edge-to-edge so the WebView paints behind
// the status bar and gesture/navigation bar. Both system bars become fully
// transparent — the app's own background (cotton candy gradient) shows
// through, giving the "full-height, branded chrome" look.
//
// No-op on web. Imports are dynamic so the Capacitor JS never ships in the
// browser bundle if the plugins aren't loaded.
// ─────────────────────────────────────────────────────────────────────────────

export function NativeShellInit() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform()) return;

      const [{ StatusBar, Style }, { EdgeToEdge }] = await Promise.all([
        import("@capacitor/status-bar"),
        import("@capawesome/capacitor-android-edge-to-edge-support"),
      ]);

      if (cancelled) return;

      try {
        // Status bar: WebView paints under it, icons are dark (our bg is light).
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Light }); // Light = dark icons
        await StatusBar.setBackgroundColor({ color: "#00000000" });
      } catch {
        // StatusBar plugin may not be available on every Capacitor version.
      }

      try {
        // Navigation bar: fully transparent so the app background bleeds through.
        // Background color is configured declaratively in capacitor.config.ts
        // (plugins.EdgeToEdge); enable() takes no args in plugin v8.
        await EdgeToEdge.enable();
      } catch {
        // Plugin not installed in current build — ignore silently.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
