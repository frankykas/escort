"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, FileText, Camera, Zap, CheckCircle, Lock } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { PersonaVerification } from "@/components/verification/PersonaVerification";
import { YotiAgeVerification } from "@/components/verification/YotiAgeVerification";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

type VerificationState = "none" | "pending" | "verified";
type AgeVerificationState = "none" | "pending" | "verified" | "failed" | "cancelled";

const STEPS: { icon: typeof FileText; titleKey: TranslationKey; descKey: TranslationKey }[] = [
  { icon: Camera, titleKey: "verify_step_1_title", descKey: "verify_step_1_desc" },
  { icon: FileText, titleKey: "verify_step_2_title", descKey: "verify_step_2_desc" },
  { icon: ShieldCheck, titleKey: "verify_step_3_title", descKey: "verify_step_3_desc" },
];

const PERK_KEYS: TranslationKey[] = [
  "verify_perk_1",
  "verify_perk_2",
  "verify_perk_3",
  "verify_perk_4",
  "verify_perk_5",
];

export default function VerifyPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, checked } = useSession();
  const [verificationStatus, setVerificationStatus] = useState<VerificationState>("none");
  const [ageVerificationStatus, setAgeVerificationStatus] = useState<AgeVerificationState>("none");
  const [yotiAgeVerified, setYotiAgeVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
  }, [user, checked, router]);

  function refreshVerificationStatus() {
    if (!user) return;

    supabase
      .from("profiles")
      .select("verification_status, age_verification_status, yoti_age_verified")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setVerificationStatus(data.verification_status as VerificationState);
          setAgeVerificationStatus((data.age_verification_status ?? "none") as AgeVerificationState);
          setYotiAgeVerified(Boolean(data.yoti_age_verified));
        }
        setLoading(false);
      });
  }

  useEffect(() => {
    refreshVerificationStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || loading) return null;

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">{t("verify_header")}</span>
      </header>

      <div className="mx-auto max-w-lg space-y-8 px-4 pt-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-pink-200 bg-gradient-to-br from-pink-100 to-sky-50">
            <ShieldCheck size={36} className="text-pink-500" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-slate-800">
              {verificationStatus === "verified" ? t("verify_hero_title_verified") :
               verificationStatus === "pending" ? t("verify_hero_title_pending") :
               t("verify_hero_title_none")}
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">
              {verificationStatus === "verified"
                ? t("verify_hero_body_verified")
                : verificationStatus === "pending"
                ? t("verify_hero_body_pending")
                : yotiAgeVerified
                ? t("verify_hero_body_age_verified")
                : t("verify_hero_body_none")}
            </p>
          </div>
        </div>

        {verificationStatus === "verified" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle size={32} className="text-emerald-500" />
            </div>
            <p className="text-[14px] font-semibold text-emerald-500">{t("verify_verified_heading")}</p>
            <p className="text-[12px] text-slate-500">{t("verify_verified_sub")}</p>
          </div>
        )}

        {verificationStatus === "pending" && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-pink-200 bg-pink-50 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-100">
              <ShieldCheck size={32} className="text-pink-500" />
            </div>
            <p className="text-[14px] font-semibold text-pink-500">{t("verify_pending_heading")}</p>
            <p className="text-[12px] text-slate-500">{t("verify_pending_sub")}</p>
          </div>
        )}

        {verificationStatus === "none" && (
          <>
            <div>
              <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("verify_how_header")}</p>
              <div className="space-y-3">
                {STEPS.map((step, i) => (
                  <div key={step.titleKey} className="flex gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-4">
                    <div className="relative flex-shrink-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
                        <step.icon size={20} />
                      </div>
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-400 text-[10px] font-bold text-slate-800">
                        {i + 1}
                      </span>
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold text-slate-800">{t(step.titleKey)}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{t(step.descKey)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-4 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">{t("verify_benefits_header")}</p>
              <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
                {PERK_KEYS.map((perkKey) => (
                  <div key={perkKey} className="flex items-center gap-3 px-4 py-3.5">
                    <CheckCircle size={15} className="flex-shrink-0 fill-pink-100 text-pink-500" />
                    <span className="text-[13px] text-slate-600">{t(perkKey)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <Lock size={16} className="mt-0.5 flex-shrink-0 text-slate-500" />
              <p className="text-[12px] leading-relaxed text-slate-500">{t("verify_privacy_note")}</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3">
                <Zap size={14} className="text-pink-500" />
                <span className="text-[13px] font-medium text-pink-500">{t("verify_choose_note")}</span>
              </div>

              <div className="rounded-2xl border border-sky-100 bg-white px-4 py-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Camera size={19} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-800">{t("verify_yoti_title")}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t("verify_yoti_body")}</p>
                  </div>
                </div>
                <YotiAgeVerification
                  isVerified={yotiAgeVerified}
                  status={ageVerificationStatus}
                  onComplete={refreshVerificationStatus}
                />
              </div>

              <div className="rounded-2xl border border-pink-100 bg-white px-4 py-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
                    <FileText size={19} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-800">{t("verify_persona_title")}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t("verify_persona_body")}</p>
                  </div>
                </div>
                <PersonaVerification userId={user.id} onComplete={refreshVerificationStatus} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
