"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </Link>
        <span className="text-[15px] font-semibold text-white">Terms of Service</span>
      </header>

      <div className="mx-auto max-w-2xl px-5 pt-8 space-y-8 text-[14px] leading-relaxed text-zinc-400">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-zinc-600 mb-2">
            Last updated: April 8, 2026
          </p>
          <h1 className="text-[22px] font-bold text-white">Terms of Service</h1>
          <p className="mt-2">
            Welcome to Cleopatra. By accessing or using our platform, you agree to be bound
            by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the platform.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">1. Eligibility</h2>
          <p>
            You must be at least <strong className="text-white">18 years of age</strong> to
            create an account or use Cleopatra. By registering, you confirm that you are
            18 or older and legally permitted to use this service in your jurisdiction.
          </p>
          <p>
            We reserve the right to request proof of age at any time. Accounts found to
            belong to individuals under 18 will be immediately terminated.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">2. Account Responsibilities</h2>
          <p>
            You are responsible for maintaining the confidentiality of your login credentials.
            You agree to notify us immediately of any unauthorized use. We are not liable for
            any losses arising from unauthorized access to your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">3. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Post content involving minors in any capacity</li>
            <li>Upload non-consensual imagery or content</li>
            <li>Engage in harassment, threats, or abuse of other users</li>
            <li>Use the platform for human trafficking or any illegal activity</li>
            <li>Impersonate another person or misrepresent your identity</li>
            <li>Attempt to circumvent security measures or access restrictions</li>
            <li>Distribute malware, spam, or engage in phishing</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">4. Content Ownership & Licensing</h2>
          <p>
            You retain ownership of content you upload. By posting content, you grant
            Cleopatra a non-exclusive, worldwide, royalty-free license to display, distribute,
            and promote your content on the platform.
          </p>
          <p>
            You represent that you have all necessary rights to the content you post
            and that it does not infringe on any third party&apos;s intellectual property rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">5. Content Moderation & Removal</h2>
          <p>
            We reserve the right to remove any content that violates these Terms or is
            reported by other users. Content decisions are made at our sole discretion.
          </p>
          <p>
            If you believe your content was removed in error, you may contact our
            support team for review.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">6. DMCA & Takedown Requests</h2>
          <p>
            If you believe content on Cleopatra infringes your copyright, you may submit
            a DMCA takedown notice to our designated copyright agent. Your notice must include:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Identification of the copyrighted work</li>
            <li>Identification of the infringing content and its location on the platform</li>
            <li>Your contact information</li>
            <li>A statement of good faith belief that the use is unauthorized</li>
            <li>A statement under penalty of perjury that the information is accurate</li>
            <li>Your physical or electronic signature</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">7. Payments & Billing</h2>
          <p>
            Certain features require payment (listing bumps, post credits, subscriptions).
            All monetary amounts are in the currency displayed at the time of purchase.
            Payments are processed securely through Stripe.
          </p>
          <p>
            Refund policies are outlined at the point of purchase. Fraudulent chargebacks
            may result in account suspension.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">8. Identity Verification</h2>
          <p>
            Providers may opt in to identity verification through our third-party partner,
            Persona. Verification grants a gold badge on your profile. By submitting verification,
            you consent to Persona&apos;s processing of your identity documents in accordance with
            their privacy policy.
          </p>
          <p>
            Cleopatra does not store your raw identity documents. Only the verification result
            is retained.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">9. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violations of these Terms,
            with or without notice. You may delete your account at any time from your profile settings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">10. Disclaimer of Warranties</h2>
          <p>
            Cleopatra is provided &quot;as is&quot; without warranties of any kind, express or implied.
            We do not guarantee uninterrupted or error-free service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">11. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Cleopatra shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use
            of the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">12. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. Continued use of the platform after
            changes constitutes acceptance. We will notify users of material changes via
            email or in-app notification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold text-white">13. Contact</h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <span className="text-amber-400">legal@cleopatra.app</span>.
          </p>
        </section>
      </div>
    </div>
  );
}
