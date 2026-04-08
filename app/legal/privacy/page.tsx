"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <span className="text-[15px] font-semibold text-white">Privacy Policy</span>
      </header>

      <div className="mx-auto max-w-2xl px-5 pt-8 space-y-8 text-[14px] leading-relaxed text-zinc-400">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-2">
            Last updated: April 8, 2026
          </p>
          <h1 className="text-[22px] font-bold text-white">Privacy Policy</h1>
          <p className="mt-2">
            Your privacy matters to us. This Privacy Policy explains how Cleopatra
            (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) collects, uses, shares, and protects your
            personal information.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">1. Information We Collect</h2>
          <h3 className="text-[14px] font-medium text-zinc-300">Account Information</h3>
          <p>
            When you register, we collect your email address and password (hashed and stored
            securely by Supabase Auth). You may also provide a username, bio, city, profile
            photo, and other optional details.
          </p>
          <h3 className="text-[14px] font-medium text-zinc-300">Content You Post</h3>
          <p>
            Photos, captions, listings, comments, and messages you create on the platform.
          </p>
          <h3 className="text-[14px] font-medium text-zinc-300">Usage Data</h3>
          <p>
            We collect information about how you interact with the platform: pages visited,
            features used, post views, search queries, and device/browser information.
          </p>
          <h3 className="text-[14px] font-medium text-zinc-300">Location Data</h3>
          <p>
            If you use the &quot;Near Me&quot; feature, we request your browser&apos;s geolocation to
            show nearby providers. This data is not stored on our servers &mdash; it is only
            used for the duration of your session.
          </p>
          <h3 className="text-[14px] font-medium text-zinc-300">Identity Verification</h3>
          <p>
            If you opt in to verification, our partner Persona processes your ID documents
            and selfie. Cleopatra receives only the verification result (approved, pending,
            or rejected) and a reference ID. We do not store your raw documents.
          </p>
          <h3 className="text-[14px] font-medium text-zinc-300">Payment Information</h3>
          <p>
            Payments are processed by Stripe. We do not store your credit card number or
            full payment details. We receive transaction confirmations and subscription status.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Provide, maintain, and improve the platform</li>
            <li>Process transactions and send related notifications</li>
            <li>Personalize your experience (feed, recommendations, search results)</li>
            <li>Communicate with you about your account, updates, and promotions</li>
            <li>Enforce our Terms of Service and protect platform safety</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">3. Information Sharing</h2>
          <p>We do not sell your personal information. We may share data with:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong className="text-zinc-300">Service providers:</strong> Supabase (database/auth),
              Stripe (payments), Persona (verification), and hosting providers
            </li>
            <li>
              <strong className="text-zinc-300">Law enforcement:</strong> When required by law
              or to protect safety
            </li>
            <li>
              <strong className="text-zinc-300">Other users:</strong> Your public profile, posts,
              and listings are visible to other users as part of the platform&apos;s core functionality
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">4. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you
            delete your account, we will remove your personal data within 30 days,
            except where retention is required by law.
          </p>
          <p>
            Anonymized usage analytics may be retained indefinitely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including encrypted connections
            (TLS), secure password hashing, Row Level Security on our database, and regular
            security audits. However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability (receive your data in a structured format)</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise these rights, contact us at{" "}
            <span className="text-amber-400">privacy@cleopatra.app</span>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">7. Cookies & Tracking</h2>
          <p>
            We use essential cookies for authentication and session management.
            We do not use third-party advertising trackers. Analytics cookies are
            used only to improve platform performance and user experience.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">8. Children&apos;s Privacy</h2>
          <p>
            Cleopatra is strictly for users aged 18 and over. We do not knowingly
            collect information from anyone under 18. If we discover an underage
            account, it will be immediately terminated and all associated data deleted.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. We will notify you of
            material changes via email or in-app notification. Your continued use
            after changes constitutes acceptance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">10. Contact</h2>
          <p>
            For privacy-related inquiries, contact us at{" "}
            <span className="text-amber-400">privacy@cleopatra.app</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
