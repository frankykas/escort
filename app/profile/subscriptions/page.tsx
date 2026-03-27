"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Crown, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { supabase } from "@/lib/supabase/client";

type Sub = {
  id: string;
  status: "active" | "cancelled" | "expired" | "past_due";
  current_period_end: string | null;
  created_at: string;
  subscription_tiers: {
    monthly_rate: number;
    description: string | null;
  } | null;
  provider: {
    id: string;
    username: string;
    avatar_url: string | null;
    verification_status: string;
  } | null;
};

const STATUS_CONFIG = {
  active:    { label: "Active",    color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "text-zinc-400",    bg: "bg-zinc-700/30",    icon: XCircle },
  expired:   { label: "Expired",   color: "text-zinc-500",    bg: "bg-zinc-700/30",    icon: Clock },
  past_due:  { label: "Past due",  color: "text-red-400",     bg: "bg-red-500/10",     icon: XCircle },
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const { user, checked } = useSession();

  const [subs, setSubs]     = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!checked) return;
    if (!user) { router.replace("/auth/signin"); return; }
    supabase
      .from("subscriptions")
      .select(`
        id, status, current_period_end, created_at,
        subscription_tiers ( monthly_rate, description ),
        provider:profiles!subscriptions_provider_id_fkey ( id, username, avatar_url, verification_status )
      `)
      .eq("subscriber_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setSubs((data as unknown as Sub[]) ?? []);
        setLoading(false);
      });
  }, [user, checked]);

  const active = subs.filter((s) => s.status === "active");
  const inactive = subs.filter((s) => s.status !== "active");

  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/5 bg-zinc-950/90 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold text-white">Subscriptions</span>
        {active.length > 0 && (
          <span className="ml-auto rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[12px] font-semibold text-amber-400">
            {active.length} active
          </span>
        )}
      </header>

      {loading ? (
        <div className="flex items-center justify-center pt-24">
          <Loader2 size={24} className="animate-spin text-zinc-600" />
        </div>
      ) : subs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 pt-24 px-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-800/60">
            <Crown size={32} className="text-zinc-600" />
          </div>
          <p className="text-[16px] font-semibold text-white">No subscriptions yet</p>
          <p className="text-[13px] text-zinc-500">
            Subscribe to a provider to get access to their exclusive content.
          </p>
          <Link
            href="/explore"
            className="mt-2 rounded-full bg-amber-400 px-6 py-2.5 text-[14px] font-semibold text-zinc-950 transition hover:bg-amber-300"
          >
            Explore providers
          </Link>
        </div>
      ) : (
        <div className="mx-auto max-w-lg px-4 pt-4 space-y-6">
          {active.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Active</p>
              <div className="space-y-3">
                {active.map((sub) => <SubCard key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">Past</p>
              <div className="space-y-3">
                {inactive.map((sub) => <SubCard key={sub.id} sub={sub} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubCard({ sub }: { sub: Sub }) {
  const cfg = STATUS_CONFIG[sub.status];
  const StatusIcon = cfg.icon;
  const provider = sub.provider;
  const isVerified = provider?.verification_status === "verified";

  return (
    <Link
      href={provider ? `/u/${provider.username}` : "#"}
      className="flex items-center gap-4 rounded-2xl border border-white/5 bg-zinc-900 px-4 py-4 transition hover:border-white/10 active:scale-[0.99]"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="h-12 w-12 overflow-hidden rounded-full bg-zinc-800">
          {provider?.avatar_url ? (
            <Image src={provider.avatar_url} alt={provider.username} width={48} height={48} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-bold text-zinc-400">
              {provider?.username?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        {isVerified && (
          <CheckCircle size={14} className="absolute -bottom-0.5 -right-0.5 fill-zinc-900 text-amber-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-semibold text-white truncate">
            @{provider?.username ?? "unknown"}
          </p>
        </div>
        {sub.subscription_tiers?.description && (
          <p className="text-[12px] text-zinc-500 truncate">{sub.subscription_tiers.description}</p>
        )}
        {sub.current_period_end && sub.status === "active" && (
          <p className="mt-1 text-[11px] text-zinc-600">
            Renews {formatDate(sub.current_period_end)}
          </p>
        )}
      </div>

      {/* Right: price + status */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        {sub.subscription_tiers?.monthly_rate && (
          <p className="text-[14px] font-bold text-white">
            CA${Math.round(sub.subscription_tiers.monthly_rate / 100)}
            <span className="text-[11px] font-normal text-zinc-500">/mo</span>
          </p>
        )}
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cfg.bg, cfg.color)}>
          <StatusIcon size={10} />
          {cfg.label}
        </span>
      </div>
    </Link>
  );
}
