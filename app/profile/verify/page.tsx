"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, FileText, Camera, Zap, CheckCircle, Lock } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PersonaVerification } from "@/components/verification/PersonaVerification";

const STEPS = [
  {
    icon: FileText,
    title: "Submit photo ID",
    description: "Government-issued passport or driver's licence. Must be valid and clearly readable.",
  },
  {
    icon: Camera,
    title: "Face match",
    description: "A quick selfie to confirm the ID belongs to you. Powered by Persona's secure identity platform.",
  },
  {
    icon: ShieldCheck,
    title: "Get your gold badge",
    description: "Verified profiles receive a gold checkmark, appear higher in search, and earn more trust from clients.",
  },
];

const PERKS = [
  "Gold verified badge on your profile",
  "Priority placement in Explore",
  "Higher enquiry conversion rates",
  "Unlocks subscription & premium content features",
  "Access to verified-only promotional campaigns",
];

type VerificationState = "none" | "pending" | "verified";

export default function VerifyPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const [verificationStatus, setVerificationStatus] = useState<VerificationState>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked, router]);

  // Fetch current verification status
  useEffect(() => {
    if (!user) return;

    supabase
      .from("profiles")
      .select("verification_status")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setVerificationStatus(data.verification_status as VerificationState);
        setLoading(false);
      });
  }, [user]);

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">ID Verification</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-8 space-y-8">
        {/* Hero */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-400/5 border border-amber-400/20">
            <ShieldCheck size={36} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-white">
              {verificationStatus === "verified" ? "You're Verified" :
               verificationStatus === "pending" ? "Verification Pending" :
               "Get Verified"}
            </h1>
            <p className="mt-1.5 text-[14px] text-zinc-400 leading-relaxed">
              {verificationStatus === "verified"
                ? "Your identity has been confirmed. You have the gold badge."
                : verificationStatus === "pending"
                ? "Your ID is being reviewed. This usually takes a few minutes."
                : "Earn the gold badge that shows clients you're a real, trusted provider on Cleopatra."}
            </p>
          </div>
        </div>

        {/* Already verified */}
        {verificationStatus === "verified" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle size={32} className="text-emerald-400" />
            </div>
            <p className="text-[14px] font-semibold text-emerald-400">Identity verified</p>
            <p className="text-[12px] text-zinc-500">
              Your gold badge is active across your profile, posts, and listings.
            </p>
          </div>
        )}

        {/* Pending */}
        {verificationStatus === "pending" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/15">
              <ShieldCheck size={32} className="text-amber-400" />
            </div>
            <p className="text-[14px] font-semibold text-amber-400">Under review</p>
            <p className="text-[12px] text-zinc-500">
              We're reviewing your submission. You'll receive the gold badge once approved.
            </p>
          </div>
        )}

        {/* How it works — show when not yet verified */}
        {verificationStatus === "none" && (
          <>
            <div>
              <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">How it works</p>
              <div className="space-y-3">
                {STEPS.map((step, i) => (
                  <div
                    key={step.title}
                    className="flex gap-4 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400">
                        <step.icon size={20} />
                      </div>
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-zinc-950">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-white">{step.title}</p>
                      <p className="mt-0.5 text-[12px] text-zinc-500 leading-snug">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Perks */}
            <div>
              <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Benefits</p>
              <div className="rounded-2xl border border-white/5 bg-zinc-900 divide-y divide-white/5">
                {PERKS.map((perk) => (
                  <div key={perk} className="flex items-center gap-3 px-4 py-3.5">
                    <CheckCircle size={15} className="flex-shrink-0 text-amber-400 fill-amber-400/20" />
                    <span className="text-[13px] text-zinc-300">{perk}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy note */}
            <div className="flex gap-3 rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-4">
              <Lock size={16} className="flex-shrink-0 text-zinc-500 mt-0.5" />
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Your ID is processed by Persona's secure identity platform. Cleopatra never stores your raw ID documents. Only a verification result is retained.
              </p>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3">
                <Zap size={14} className="text-amber-400" />
                <span className="text-[13px] font-medium text-amber-400">Verification usually takes under 5 minutes</span>
              </div>

              <PersonaVerification
                userId={user.id}
                onComplete={() => {
                  // Re-fetch status — could be auto-approved ("verified") or "pending"
                  supabase
                    .from("profiles")
                    .select("verification_status")
                    .eq("id", user.id)
                    .single()
                    .then(({ data }) => {
                      if (data) setVerificationStatus(data.verification_status as VerificationState);
                    });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
