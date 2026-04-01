"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronLeft, ShieldBan, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type BlockedUser = {
  id: string;
  blocked_id: string;
  created_at: string;
  profile: {
    username: string;
    avatar_url: string | null;
  };
};

export default function BlockedListPage() {
  const router = useRouter();
  const { user, checked } = useSession();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("blocked_users")
      .select("id, blocked_id, created_at, profile:blocked_id (username, avatar_url)")
      .eq("blocker_id", user.id)
      .order("created_at", { ascending: false });

    setBlocked(
      (data ?? []).map((row) => ({
        ...row,
        profile: row.profile as unknown as BlockedUser["profile"],
      })) as BlockedUser[]
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (checked && !user) router.replace("/auth/signin");
    else fetchBlocked();
  }, [user, checked, router, fetchBlocked]);

  async function handleUnblock(blockedId: string) {
    if (!user) return;
    setUnblocking(blockedId);
    await fetch("/api/block", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockerId: user.id, blockedId }),
    });
    setBlocked((prev) => prev.filter((b) => b.blocked_id !== blockedId));
    setUnblocking(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Blocked Users</span>
      </header>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {loading ? (
          <div className="flex items-center justify-center pt-24">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
          </div>
        ) : blocked.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 pt-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <ShieldBan size={28} className="text-zinc-600" />
            </div>
            <p className="text-[15px] font-semibold text-zinc-300">No blocked users</p>
            <p className="text-[13px] text-zinc-600">
              Users you block won&apos;t be able to send you message requests.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
              {blocked.length} blocked
            </p>
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-3"
              >
                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  {b.profile.avatar_url ? (
                    <Image
                      src={b.profile.avatar_url}
                      alt={b.profile.username}
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-zinc-500">
                      {b.profile.username[0].toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">
                    @{b.profile.username}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Blocked {new Date(b.created_at).toLocaleDateString("en-CA", {
                      month: "short", day: "numeric",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => handleUnblock(b.blocked_id)}
                  disabled={unblocking === b.blocked_id}
                  className="rounded-full border border-white/10 px-3.5 py-1.5 text-[12px] font-semibold text-zinc-300 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                >
                  {unblocking === b.blocked_id ? "..." : "Unblock"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
