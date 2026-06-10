"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, Layers, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-fetch";

type Bundle = {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  is_active: boolean;
};

export default function AdminBundlesPage() {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/admin/bundles");
    if (res.ok) setBundles((await res.json()).bundles ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create() {
    const monthlyPriceCents = Math.round(parseFloat(price || "0") * 100);
    if (!name.trim() || monthlyPriceCents <= 0 || saving) return;
    setSaving(true);
    const res = await apiFetch("/api/admin/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: desc.trim() || undefined, monthlyPriceCents }),
    });
    setSaving(false);
    if (res.ok) { setName(""); setDesc(""); setPrice(""); void load(); }
  }

  async function toggle(b: Bundle) {
    await apiFetch("/api/admin/bundles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bundleId: b.id, isActive: !b.is_active }),
    });
    void load();
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <span className="text-[15px] font-semibold text-slate-800">All-access bundles</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-5">
        {/* Create */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-[13px] font-semibold text-slate-700">New bundle</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. All-Access Pass)"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-pink-300" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-pink-300" />
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <span className="text-[13px] font-semibold text-pink-500">CA$</span>
            <input type="number" min="1" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Monthly price"
              className="flex-1 bg-transparent text-[14px] font-semibold outline-none" />
          </div>
          <button onClick={create} disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[rgb(246,51,154)] py-2.5 text-[14px] font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Create bundle
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center pt-8"><Loader2 size={22} className="animate-spin text-slate-400" /></div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center gap-2 pt-8 text-center text-slate-400">
            <Layers size={24} /><p className="text-[13px]">No bundles yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bundles.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">{b.name}</p>
                  <p className="text-[12px] text-slate-400">CA${Math.round(b.monthly_price / 100)}/mo</p>
                </div>
                <button onClick={() => toggle(b)}
                  className={cn("rounded-full px-3 py-1 text-[12px] font-semibold",
                    b.is_active ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-slate-500")}>
                  {b.is_active ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
