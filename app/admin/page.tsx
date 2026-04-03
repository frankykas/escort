"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users, ShieldCheck, MessageSquare, FileText, Heart, MessageCircle,
  UserPlus, AlertTriangle, TrendingUp, Crown, Eye, Clock,
  Image as ImageIcon, ListOrdered, UserCheck, Loader2, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/useSession";
import { AdminActions } from "./AdminActions";
import type { DashboardStats, RecentUser, ReportRow } from "@/lib/admin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboard() {
  const { user } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData(showRefresh = false) {
    if (!user) return;
    if (showRefresh) setRefreshing(true);

    const res = await fetch(`/api/admin/dashboard?userId=${user.id}`);
    if (!res.ok) {
      router.replace("/");
      return;
    }

    const data = await res.json();
    setStats(data.stats);
    setRecentUsers(data.recentUsers ?? []);
    setReports(data.reports ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  if (loading || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-zinc-600" />
      </div>
    );
  }

  const statCards: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bg: string;
  }[] = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "Providers", value: stats.totalProviders, icon: Crown, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Clients", value: stats.totalClients, icon: UserCheck, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Verified", value: stats.verifiedProviders, icon: ShieldCheck, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Posts", value: stats.totalPosts, icon: ImageIcon, color: "text-pink-400", bg: "bg-pink-500/10" },
    { label: "Stories", value: stats.totalStories, icon: Eye, color: "text-orange-400", bg: "bg-orange-500/10" },
    { label: "Active Listings", value: stats.totalListings, icon: ListOrdered, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Active Chats", value: stats.activeChats, icon: MessageSquare, color: "text-sky-400", bg: "bg-sky-500/10" },
    { label: "Pending Requests", value: stats.pendingRequests, icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
    { label: "Pending Reports", value: stats.pendingReports, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Total Likes", value: stats.totalLikes, icon: Heart, color: "text-rose-400", bg: "bg-rose-500/10" },
    { label: "Total Comments", value: stats.totalComments, icon: MessageCircle, color: "text-teal-400", bg: "bg-teal-500/10" },
    { label: "Total Follows", value: stats.totalFollows, icon: UserPlus, color: "text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Signups Today", value: stats.signupsToday, icon: TrendingUp, color: "text-lime-400", bg: "bg-lime-500/10" },
    { label: "Signups (7d)", value: stats.signupsThisWeek, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-zinc-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-[12px] text-zinc-500">Cleopatre Platform Overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-medium text-zinc-400 transition hover:border-white/20 hover:text-white disabled:opacity-40"
            >
              <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
              Refresh
            </button>
            <Link
              href="/"
              className="rounded-lg border border-white/10 px-4 py-2 text-[13px] font-medium text-zinc-400 transition hover:border-white/20 hover:text-white"
            >
              Back to App
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-10">
        {/* Stats Grid */}
        <section>
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
            Platform Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 p-4 shadow-md"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", card.bg)}>
                      <Icon size={16} className={card.color} />
                    </div>
                    <div>
                      <p className="text-[22px] font-bold leading-none text-white">
                        {card.value.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{card.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Recent Signups */}
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Recent Signups
            </h2>
            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md overflow-hidden">
              {recentUsers.length === 0 ? (
                <p className="p-6 text-[13px] text-zinc-600 text-center">No users yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {recentUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-zinc-800">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.username}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-400">
                            {u.username[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/u/${u.username}`}
                            className="text-[13px] font-semibold text-white hover:text-amber-400 truncate"
                          >
                            {u.username}
                          </Link>
                          {u.verification_status === "verified" && (
                            <ShieldCheck size={11} className="text-amber-400 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500">
                          {u.is_provider ? "Provider" : "Client"} · {timeAgo(u.created_at)}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-700 flex-shrink-0">
                        {u.id.slice(0, 8)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Pending Reports */}
          <section>
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-zinc-500 mb-4">
              Pending Reports
              {reports.length > 0 && (
                <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {reports.length}
                </span>
              )}
            </h2>
            <div className="rounded-2xl border border-white/5 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-md overflow-hidden">
              {reports.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <ShieldCheck size={24} className="text-emerald-500/60" />
                  <p className="text-[13px] text-zinc-600">No pending reports. All clear.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {reports.map((report) => (
                    <div key={report.id} className="px-4 py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              report.reason === "underage" || report.reason === "non_consensual"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-amber-400/15 text-amber-400"
                            )}>
                              {report.reason.replace(/_/g, " ")}
                            </span>
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                              {report.target_type}
                            </span>
                          </div>
                          {report.details && (
                            <p className="mt-1.5 text-[12px] text-zinc-400 line-clamp-2">
                              {report.details}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-zinc-600">
                            By @{report.reporter?.username ?? "unknown"} · {timeAgo(report.created_at)}
                          </p>
                        </div>
                      </div>
                      <AdminActions reportId={report.id} onResolved={() => fetchData(true)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
