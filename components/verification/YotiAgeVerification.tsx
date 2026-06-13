"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2, ScanFace, ShieldAlert } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

type Props = {
  isVerified: boolean;
  status: "none" | "pending" | "verified" | "failed" | "cancelled";
  onComplete?: () => void;
};

async function readApiError(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export function YotiAgeVerification({ isVerified, status, onComplete }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<typeof status>(status);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(status);
  }, [status]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("sessionId");
    const isSandboxReturn = params.get("yoti_sandbox") === "1";
    const isCancelled = params.get("yoti_status") === "cancelled";
    if (isCancelled) {
      setResult("cancelled");
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    if (!sessionId && !isSandboxReturn) return;

    void completeYoti(sessionId ?? "");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function completeYoti(sessionId: string) {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/yoti/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) throw new Error(await readApiError(res, t("yoti_error")));

      const data = await res.json();
      setResult(data.age_verification_status ?? "pending");
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("yoti_error"));
      setResult("failed");
    } finally {
      setLoading(false);
    }
  }

  async function startYoti() {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch("/api/yoti/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(await readApiError(res, t("yoti_error")));

      const data = await res.json();
      if (!data.launch_url) throw new Error("Missing launch URL");

      window.location.href = data.launch_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("yoti_error"));
      setLoading(false);
    }
  }

  if (isVerified || result === "verified") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <div className="flex items-start gap-3">
          <CheckCircle size={19} className="mt-0.5 flex-shrink-0 text-emerald-500" />
          <div>
            <p className="text-[14px] font-bold text-slate-800">{t("yoti_verified_title")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{t("yoti_verified_body")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={startYoti}
        disabled={loading}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[15px] font-bold transition-all active:scale-[0.98]",
          loading
            ? "cursor-wait bg-sky-200 text-slate-600"
            : "bg-sky-100 text-sky-700 hover:bg-sky-200"
        )}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            {t("yoti_opening")}
          </>
        ) : (
          <>
            <ScanFace size={18} />
            {t("yoti_start")}
          </>
        )}
      </button>

      {(result === "failed" || error) && (
        <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-red-500">
          <ShieldAlert size={13} />
          {error ?? t("yoti_failed")}
        </p>
      )}
    </div>
  );
}
