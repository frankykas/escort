"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Layers, Check, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";
import { USE_CREATOR_CONTENT } from "@/lib/features";
import PayButton from "@/components/creator/PayButton";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
};

export default function BundlesPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [activeBundleIds, setActiveBundleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }

    Promise.all([
      supabase.from("bundles").select("id, name, description, monthly_price").eq("is_active", true).order("monthly_price"),
      supabase.from("bundle_subscriptions").select("bundle_id, current_period_end").eq("subscriber_id", user.id).in("status", ["active", "cancelled"]),
    ]).then(([bundlesRes, subsRes]) => {
      setBundles((bundlesRes.data ?? []) as Bundle[]);
      const active = new Set(
        (subsRes.data ?? [])
          .filter((s) => !s.current_period_end || new Date(s.current_period_end).getTime() > Date.now())
          .map((s) => s.bundle_id as string)
      );
      setActiveBundleIds(active);
      setLoading(false);
    });
  }, [checked, user, router]);

  if (!USE_CREATOR_CONTENT) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] text-slate-400">Not available.</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">All-access bundles</span>
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100"><Layers size={28} className="text-slate-400" /></div>
          <p className="text-[15px] font-semibold text-slate-800">No bundles available</p>
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
          <div className="flex items-center gap-2 rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-4">
            <Sparkles size={18} className="text-pink-500" />
            <p className="text-[13px] text-slate-600">One pass unlocks the subscribers-only content of every creator on the platform.</p>
          </div>

          {bundles.map((b) => {
            const isActive = activeBundleIds.has(b.id);
            return (
              <div key={b.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[16px] font-bold text-slate-800">{b.name}</p>
                    {b.description && <p className="mt-1 text-[13px] text-slate-500">{b.description}</p>}
                  </div>
                  <p className="text-[20px] font-bold text-slate-800">
                    CA${Math.round(b.monthly_price / 100)}
                    <span className="text-[12px] font-normal text-slate-400">/mo</span>
                  </p>
                </div>
                <div className="mt-4">
                  {isActive ? (
                    <div className="flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 text-[14px] font-semibold text-emerald-600">
                      <Check size={16} /> Active
                    </div>
                  ) : (
                    <PayButton
                      purpose="bundle"
                      referenceId={b.id}
                      label={`Get all-access · CA$${Math.round(b.monthly_price / 100)}/mo`}
                      className={cn("w-full")}
                      onError={setError}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {error && <p className="text-center text-[13px] text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}
