import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/ui/BottomNav";
import { TopBar } from "@/components/ui/TopBar";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { ProfileProvider } from "@/contexts/ProfileContext";

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
          <TopBar />
          {children}
          <BottomNav />
          <LocaleSwitcher />
        </ProfileProvider>
      </body>
    </html>
  );
}
