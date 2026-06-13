"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Radio, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { USE_LIVE_SHOWS } from "@/lib/features";

export default function NewStreamPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function goLive() {
    if (!title.trim() || starting) return;
    setStarting(true);
    setError(null);
    const ticketPriceCents = price ? Math.round(parseFloat(price) * 100) : 0;
    const res = await apiFetch("/api/streams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), ticketPriceCents }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.stream) {
      router.replace(`/live/${data.stream.id}`);
    } else {
      setError(data.error ?? "Could not start the show.");
      setStarting(false);
    }
  }

  if (!USE_LIVE_SHOWS) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] text-slate-400">Live shows are not enabled.</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">Go live</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-6 space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-pink-50 to-white border border-pink-200 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100">
            <Radio size={20} className="text-pink-500" />
          </div>
          <p className="text-[13px] text-slate-600">Start a live broadcast. Viewers can buy a ticket to join and tip you during the show.</p>
        </div>

        <div>
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Title</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the show about?"
            maxLength={120}
            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3.5 text-[15px] text-slate-800 placeholder-slate-400 outline-none focus:border-pink-300"
          />
        </div>

        <div>
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-widest text-slate-400">Ticket price (optional)</p>
          <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
            <span className="text-[15px] font-semibold text-pink-500">CA$</span>
            <input
              type="number" min="0" step="1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0 = free to join"
              className="flex-1 bg-transparent text-[16px] font-semibold text-slate-800 placeholder-slate-400 outline-none"
            />
          </div>
        </div>

        {error && <p className="text-center text-[13px] text-red-500">{error}</p>}

        <button
          onClick={goLive}
          disabled={!title.trim() || starting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(246,51,154)] py-4 text-[15px] font-semibold text-white transition hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {starting ? <Loader2 size={18} className="animate-spin" /> : <Radio size={18} />}
          {starting ? "Starting…" : "Go live now"}
        </button>
        <p className="text-center text-[12px] text-slate-400">Your camera and microphone will be requested when the show starts.</p>
      </div>
    </div>
  );
}
