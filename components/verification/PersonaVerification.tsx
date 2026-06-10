"use client";

import { useState } from "react";
import { CheckCircle, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  userId: string;
  onComplete?: () => void;
};

export function PersonaVerification({ userId, onComplete }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"pending" | "verified" | "error" | null>(null);

  async function openPersona() {
    setLoading(true);
    setResult(null);

    try {
      // Dynamic import — persona uses browser APIs
      const Persona = (await import("persona")).default;

      const templateId = process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID;
      const environmentId = process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT_ID;

      if (!templateId || !environmentId) {
        console.error("Persona env vars not configured");
        setResult("error");
        setLoading(false);
        return;
      }

      const client = new Persona.Client({
        templateId,
        environmentId,
        referenceId: userId,
        onComplete: async ({
          inquiryId,
          status,
        }: {
          inquiryId: string;
          status: string;
        }) => {
          // Send result to our backend
          try {
            const res = await apiFetch("/api/persona/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                inquiryId,
                status,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              setResult(data.verification_status === "verified" ? "verified" : "pending");
              onComplete?.();
            } else {
              setResult("error");
            }
          } catch {
            setResult("error");
          }
          setLoading(false);
        },
        onCancel: () => {
          setLoading(false);
        },
        onError: (error: unknown) => {
          console.error("Persona error:", error);
          setResult("error");
          setLoading(false);
        },
      });

      client.open();
    } catch (err) {
      console.error("Failed to load Persona:", err);
      setResult("error");
      setLoading(false);
    }
  }

  if (result === "verified") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle size={32} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-[16px] font-bold text-slate-800">{t("pv_verified_title")}</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {t("pv_verified_body")}
          </p>
        </div>
      </div>
    );
  }

  if (result === "pending") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-pink-200 bg-pink-50 px-6 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pink-100">
          <ShieldCheck size={32} className="text-pink-500" />
        </div>
        <div>
          <p className="text-[16px] font-bold text-slate-800">{t("pv_pending_title")}</p>
          <p className="mt-1 text-[13px] text-slate-500">
            {t("pv_pending_body")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={openPersona}
        disabled={loading}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[15px] font-bold transition-all active:scale-[0.98]",
          loading
            ? "bg-pink-300 text-white cursor-wait"
            : "bg-[rgb(246,51,154)] text-white hover:brightness-105"
        )}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t("pv_opening")}
          </>
        ) : (
          <>
            <ShieldCheck size={18} />
            {t("pv_start")}
          </>
        )}
      </button>

      {result === "error" && (
        <p className="text-center text-[12px] text-red-500">
          {t("pv_error")}
        </p>
      )}
    </div>
  );
}
