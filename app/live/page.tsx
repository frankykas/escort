"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, Radio, Plus, Loader2, Users } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";
import { USE_LIVE_SHOWS } from "@/lib/features";

type Stream = {
  id: string;
  title: string;
  ticket_price: number;
  viewer_count: number;
  creator_username: string | null;
  creator_avatar: string | null;
};

export default function LiveIndexPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProvider, setIsProvider] = useState(false);

  useEffect(() => {
    apiFetch("/api/streams")
      .then((r) => (r.ok ? r.json() : { streams: [] }))
      .then((d) => { setStreams(d.streams ?? []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!checked || !user) return;
    supabase.from("profiles").select("provider_type").eq("id", user.id).maybeSingle()
      .then(({ data }) => setIsProvider(data?.provider_type != null));
  }, [checked, user]);

  if (!USE_LIVE_SHOWS) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafbfc] text-slate-400">Live shows are not enabled.</div>;
  }

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-[#fafbfc]/90 px-4 py-3 backdrop-blur-xl">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-slate-800">Live now</span>
        {isProvider && (
          <Link href="/live/new" className="ml-auto flex items-center gap-1.5 rounded-full bg-[rgb(246,51,154)] px-4 py-1.5 text-[13px] font-semibold text-white hover:brightness-105">
            <Plus size={14} /> Go live
          </Link>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : streams.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 pt-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <Radio size={28} className="text-slate-400" />
          </div>
          <p className="text-[15px] font-semibold text-slate-800">No live shows right now</p>
          {isProvider && <Link href="/live/new" className="mt-1 text-[13px] font-semibold text-pink-500">Start one →</Link>}
        </div>
      ) : (
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-3 px-4 pt-4">
          {streams.map((s) => (
            <Link key={s.id} href={`/live/${s.id}`} className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-pink-200">
              <div className="relative flex aspect-[4/5] items-center justify-center bg-gradient-to-br from-pink-100 to-sky-100">
                {s.creator_avatar ? (
                  <Image src={s.creator_avatar} alt="" width={80} height={80} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <Radio size={28} className="text-pink-400" />
                )}
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  <Radio size={9} /> LIVE
                </span>
                <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                  <Users size={9} /> {s.viewer_count}
                </span>
              </div>
              <div className="p-2.5">
                <p className="truncate text-[13px] font-semibold text-slate-800">{s.title}</p>
                <p className="truncate text-[11px] text-slate-400">@{s.creator_username}</p>
                <p className="mt-1 text-[11px] font-semibold text-pink-500">
                  {s.ticket_price > 0 ? `CA$${Math.round(s.ticket_price / 100)} ticket` : "Free"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
