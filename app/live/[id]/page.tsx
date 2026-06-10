"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Lock, Heart, Radio, X } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { supabase } from "@/lib/supabase/client";
import { useSession } from "@/hooks/useSession";
import { USE_LIVE_SHOWS } from "@/lib/features";
import LiveRoom from "@/components/creator/LiveRoom";
import PayButton from "@/components/creator/PayButton";
import TipSheet from "@/components/creator/TipSheet";

type Stream = {
  id: string;
  creator_id: string;
  title: string;
  status: string;
  ticket_price: number;
  creator: { username: string; avatar_url: string | null } | null;
};

export default function LiveShowPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { user, checked } = useSession();

  const [stream, setStream] = useState<Stream | null>(null);
  const [conn, setConn] = useState<{ token: string; wsUrl: string; isHost: boolean } | null>(null);
  const [needTicket, setNeedTicket] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const connect = useCallback(async () => {
    const res = await apiFetch(`/api/streams/${id}/token`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.token) {
      setConn({ token: data.token, wsUrl: data.wsUrl, isHost: data.isHost });
      setNeedTicket(null);
    } else if (res.status === 403 && data.reason === "ticket") {
      setNeedTicket(data.ticketPrice ?? 0);
    } else if (res.status === 410) {
      setError("This show has ended.");
    } else {
      setError(data.error ?? "Could not join the show.");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }

    supabase
      .from("live_streams")
      .select("id, creator_id, title, status, ticket_price, creator:creator_id (username, avatar_url)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setError("Show not found."); setLoading(false); return; }
        setStream(data as unknown as Stream);
        void connect();
      });
  }, [checked, user, id, connect, router]);

  async function endShow() {
    setEnding(true);
    await apiFetch(`/api/streams/${id}/end`, { method: "POST" });
    router.push("/live");
  }

  if (!USE_LIVE_SHOWS) {
    return <div className="flex min-h-screen items-center justify-center bg-black text-white/70">Live shows are not enabled.</div>;
  }

  return (
    <div className="min-h-screen bg-black">
      <header className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-white">{stream?.title ?? "Live show"}</p>
          {stream?.creator && <p className="text-[12px] text-white/50">@{stream.creator.username}</p>}
        </div>
        {conn?.isHost && (
          <button
            onClick={endShow}
            disabled={ending}
            className="flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {ending ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
            End
          </button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4">
        {loading ? (
          <div className="flex aspect-video items-center justify-center"><Loader2 size={28} className="animate-spin text-white/70" /></div>
        ) : error ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 text-center text-white/70">
            <Radio size={28} className="text-white/40" />
            <p className="text-[14px]">{error}</p>
          </div>
        ) : needTicket != null ? (
          <div className="flex aspect-[9/16] max-h-[70vh] flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-black px-8 text-center sm:aspect-video">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
              <Lock size={28} className="text-pink-400" />
            </div>
            <div>
              <p className="text-[16px] font-semibold text-white">Ticketed live show</p>
              <p className="mt-1 text-[13px] text-white/60">Buy a ticket to watch @{stream?.creator?.username}.</p>
            </div>
            <PayButton
              purpose="stream"
              referenceId={id}
              label={`Buy ticket · CA$${Math.round((needTicket ?? 0) / 100)}`}
              onError={setError}
            />
            <p className="text-[11px] text-white/40">After paying, return here to join.</p>
          </div>
        ) : conn ? (
          <>
            <LiveRoom wsUrl={conn.wsUrl} token={conn.token} isHost={conn.isHost} />
            {!conn.isHost && stream?.creator && (
              <button
                onClick={() => setTipOpen(true)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgb(246,51,154)] py-3.5 text-[15px] font-semibold text-white transition hover:brightness-105"
              >
                <Heart size={16} /> Send a tip
              </button>
            )}
          </>
        ) : null}
      </div>

      {stream?.creator && (
        <TipSheet
          creatorId={stream.creator_id}
          creatorName={stream.creator.username}
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          onError={setError}
        />
      )}
    </div>
  );
}
