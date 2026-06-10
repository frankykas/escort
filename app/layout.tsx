import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/ui/BottomNav";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { ClientShell } from "@/components/ui/ClientShell";
import { NativeShellInit } from "@/components/ui/NativeShellInit";

// Pulled from NEXT_PUBLIC_SUPABASE_URL at build time so the preconnect always
// matches the env the client is talking to.
const SUPABASE_ORIGIN = (() => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
})();

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cleopatra - Private Companion Discovery",
  description:
    "Discover verified companion profiles with discreet verification, private messaging, and a privacy-first experience for adults.",
};

// `viewport-fit: cover` is what makes `env(safe-area-inset-*)` resolve to real
// pixel values inside the Capacitor WebView. Without it the insets are 0 and
// the bottom nav slides under the gesture bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdf2f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* Preconnect to Supabase so the TLS handshake happens in parallel
            with the HTML download — saves ~150-250ms on the first auth/data
            request after navigation. */}
        {SUPABASE_ORIGIN && (
          <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" />
        )}
      </head>
      <body className="min-h-full flex flex-col bg-[#fafbfc] text-slate-800 pb-[60px]">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <AccessibilityProvider>
          <ProfileProvider>
            <NativeShellInit />
            <ClientShell />
            <main id="main-content" tabIndex={-1} className="contents">
              {children}
            </main>
            <BottomNav />
            <LocaleSwitcher />
          </ProfileProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}
