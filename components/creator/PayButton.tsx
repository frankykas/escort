"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

type PayablePurpose = "subscription" | "ppv" | "message" | "stream" | "bundle";

interface PayButtonProps {
  /** What is being purchased. Tips use <TipSheet> instead (variable amount). */
  purpose: PayablePurpose;
  /** Tier id (subscription), post id (ppv), or message id (message). */
  referenceId: string;
  /** Button label, e.g. "Subscribe · CA$20/mo" or "Unlock · CA$8". */
  label: string;
  className?: string;
  icon?: React.ReactNode;
  onError?: (message: string) => void;
}

/**
 * Opens a PayRam checkout for a fixed-price purchase (amount is computed
 * server-side) and redirects the browser to the hosted payment page.
 */
export default function PayButton({
  purpose,
  referenceId,
  label,
  className,
  icon,
  onError,
}: PayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function start() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, referenceId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.url) {
        if (res.status === 401) {
          onError?.("Please sign in to continue.");
        } else {
          onError?.(data.error ?? "Could not start payment.");
        }
        return;
      }
      // Hand off to the hosted PayRam checkout page.
      window.location.href = data.url as string;
    } catch {
      onError?.("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={start}
      disabled={loading}
      className={cn(
        "flex items-center justify-center gap-2 rounded-full bg-[rgb(246,51,154)] px-5 py-2.5 text-[14px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50",
        className
      )}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}
