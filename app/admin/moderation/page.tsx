"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ShieldCheck, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

type PendingItem = {
  id: string;
  post_id: string;
  creator_id: string;
  creator_username: string | null;
  consent_attested: boolean;
  performer_count: number;
  has_consent_doc: boolean;
  caption: string | null;
  media_path: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ModerationPage() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/admin/moderation");
    if (res.ok) {
      const data = await res.json();
      setItems(data.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-gray-100 hover:text-slate-800">
          <ChevronLeft size={20} />
        </Link>
        <span className="text-[15px] font-semibold text-slate-800">Explicit content review</span>
        {items.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-600">
            {items.length} pending
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <ShieldCheck size={28} className="text-emerald-500" />
          </div>
          <p className="text-[15px] font-semibold text-slate-800">Queue is clear</p>
          <p className="text-[13px] text-slate-400">No explicit posts awaiting review.</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-3">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} onResolved={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ item, onResolved }: { item: PendingItem; onResolved: () => void }) {
  const [acting, setActing] = useState(false);

  async function review(decision: "approved" | "rejected") {
    setActing(true);
    const res = await apiFetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: item.post_id, decision }),
    });
    if (res.ok) onResolved();
    else setActing(false);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <Link href={`/u/${item.creator_username ?? ""}`} className="text-[14px] font-semibold text-slate-800 hover:text-pink-500">
          @{item.creator_username ?? "unknown"}
        </Link>
        <span className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</span>
      </div>

      {item.caption && <p className="mb-2 text-[13px] text-slate-600">{item.caption}</p>}

      <p className="mb-2 truncate text-[11px] text-slate-400">media: {item.media_path ?? "—"}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {item.performer_count} performer{item.performer_count === 1 ? "" : "s"} on record
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium",
          item.has_consent_doc ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500")}>
          {item.has_consent_doc ? "Consent doc attached" : "No consent doc"}
        </span>
      </div>

      {!item.consent_attested && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-600">
          <AlertTriangle size={12} />
          Consent not attested by uploader
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => review("rejected")}
          disabled={acting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-[13px] font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
        >
          <X size={15} /> Reject
        </button>
        <button
          onClick={() => review("approved")}
          disabled={acting}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          {acting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Approve
        </button>
      </div>
    </div>
  );
}
