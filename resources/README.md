# App Icons & Splash — drop your PNGs here

This folder is the source-of-truth for all Android app icons and splash screens.
`@capacitor/assets` reads these files and generates every density + adaptive
icon variant Android needs.

## Required files

| File | Size | Notes |
|---|---|---|
| `icon.png` | **1024 × 1024** | The classic app icon. No transparency. Edge-safe — your logo should occupy ~80% of the canvas so it isn't clipped. |
| `icon-foreground.png` | **1024 × 1024** | Transparent background. **Only the inner 66% (≈ 672 × 672 centered) is safe** — anything outside is masked by the launcher shape (circle / squircle / square). |
| `icon-background.png` | **1024 × 1024** | Solid color or simple gradient behind the foreground. Recommend a soft pink → sky gradient that matches the web app. |
| `splash.png` | **2732 × 2732** | Shown while the WebView boots. Center your logo within the inner ~25% — Android crops aggressively on different aspect ratios. Background should match `icon-background.png`. |
| `splash-dark.png` | 2732 × 2732 | *Optional* — dark-mode splash. If omitted, the light splash is used for both themes. |

## Generating

After you drop the PNGs here:

```bash
npm run cap:icons     # generates icons + splashes into android/app/src/main/res
npm run cap:sync      # not strictly needed for assets, but safe to run
```

Then rebuild the APK:

```bash
npm run cap:apk
```

## Design tips

- **Launcher masks vary.** Samsung uses a squircle, Pixel a circle, older OEMs
  a square. If your logo is near the edge of `icon-foreground.png`, it *will*
  get clipped on some phones. Keep it inside the central ~66% circle.
- **No text in the icon.** At small sizes (the 48 × 48 launcher on a densely
  packed home screen) it becomes illegible noise. Use a mark, not a wordmark.
- **Splash = brand moment, not content.** It flashes for < 1s before the
  WebView paints. Keep it minimal — just your logo on the brand background.
- **Brand pink:** `rgb(246, 51, 154)`. Use it for the icon background so the
  native app reads as "the same brand" as the web app's buttons.
