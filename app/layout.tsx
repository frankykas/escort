import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/ui/BottomNav";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { AmbientAura, Vignette } from "@/components/ui/AmbientEffects";
import { OnboardingTour } from "@/components/ui/OnboardingTour";
import { PushPermissionPrompt } from "@/components/ui/PushPermissionPrompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cleopatra — Buy & Sell Locally",
  description:
    "A premium classifieds marketplace. Post ads, browse listings, and connect with buyers and sellers in your area.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-50 pb-[60px]">
        <ProfileProvider>
          <AmbientAura />
          <Vignette />
          <div className="film-grain" aria-hidden="true" />
          {children}
          <BottomNav />
          <OnboardingTour />
          <PushPermissionPrompt />
          <LocaleSwitcher />
        </ProfileProvider>
      </body>
    </html>
  );
}
