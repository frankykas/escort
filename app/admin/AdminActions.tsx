"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { apiFetch } from "@/lib/api-fetch";

export function AdminActions({
  reportId,
  onResolved,
}: {
  reportId: string;
  onResolved?: () => void;
}) {
  const { user } = useSession();
  const [loading, setLoading] = useState<"action" | "dismiss" | null>(null);

  async function handle(resolution: "actioned" | "dismissed") {
    if (!user) return;
    setLoading(resolution === "actioned" ? "action" : "dismiss");

    const res = await apiFetch("/api/admin/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, resolution }),
    });

    setLoading(null);
    if (res.ok) onResolved?.();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handle("actioned")}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
      >
        {loading === "action" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
        Take Action
      </button>
      <button
        onClick={() => handle("dismissed")}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 transition hover:bg-zinc-800 disabled:opacity-40"
      >
        {loading === "dismiss" ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        Dismiss
      </button>
    </div>
  );
}
