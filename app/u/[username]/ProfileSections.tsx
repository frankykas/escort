"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, Clock, Eye, CalendarDays, Share2,
  Copy, Check, MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Trust & Safety ──────────────────────────────────────────────────────────

type TrustProps = {
  isVerified: boolean;
  memberSince: string | null;
  lastSeenAt: string | null;
};

function formatMemberSince(iso: string | null): string {
  if (!iso) return "Recently joined";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatLastActive(iso: string | null): string {
  if (!iso) return "Unknown";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 5) return "Online now";
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days < 7) return `Active ${days}d ago`;
  return `Active ${Math.floor(days / 7)}w ago`;
}

export function TrustSignals({ isVerified, memberSince, lastSeenAt }: TrustProps) {
  const lastActive = formatLastActive(lastSeenAt);
  const isOnline = lastActive === "Online now";

  const signals = [
    {
      icon: Shield,
      label: isVerified ? "ID Verified" : "Not yet verified",
      sublabel: isVerified ? "Identity confirmed" : "Verification pending",
      color: isVerified ? "text-pink-500" : "text-slate-400",
      bgColor: isVerified ? "bg-pink-50 border-pink-200" : "bg-gray-50 border-gray-200",
    },
    {
      icon: Clock,
      label: formatMemberSince(memberSince),
      sublabel: "Member since",
      color: "text-slate-600",
      bgColor: "bg-gray-50 border-gray-200",
    },
    {
      icon: Eye,
      label: lastActive,
      sublabel: isOnline ? "Currently active" : "Last seen",
      color: isOnline ? "text-emerald-400" : "text-slate-600",
      bgColor: isOnline ? "bg-emerald-400/10 border-emerald-400/20" : "bg-gray-50 border-gray-200",
    },
  ];

  return (
    <div className="mx-4 mt-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <Shield size={12} className="text-pink-500" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Trust & Safety
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {signals.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center",
                s.bgColor
              )}
            >
              <s.icon size={16} className={s.color} />
              <span className={cn("text-[11px] font-semibold leading-tight", s.color)}>
                {s.label}
              </span>
              <span className="text-[9px] text-slate-400">{s.sublabel}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Social Proof Strip ──────────────────────────────────────────────────────

type SocialProofProps = {
  followersCount: number;
  postsCount: number;
  memberSince: string | null;
  lastSeenAt: string | null;
};

export function SocialProofStrip({
  followersCount,
  postsCount,
  memberSince,
  lastSeenAt,
}: SocialProofProps) {
  const lastActive = formatLastActive(lastSeenAt);
  const isOnline = lastActive === "Online now";

  const items = [
    followersCount > 0 ? `${followersCount.toLocaleString()} followers` : null,
    postsCount > 0 ? `${postsCount} posts` : null,
    isOnline ? null : lastActive,  // skip if shown in trust signals as "Online now"
    memberSince ? `Joined ${formatMemberSince(memberSince)}` : null,
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5">
        <MessageCircle size={11} className="flex-shrink-0 text-slate-400" />
        <p className="text-[11px] text-slate-400">
          {items.join("  ·  ")}
        </p>
      </div>
    </div>
  );
}

// ─── Availability Spotlight ──────────────────────────────────────────────────

type AvailabilityProps = {
  schedule: Record<string, string> | null;
  availableUntil: string | null;
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function AvailabilitySpotlight({ schedule, availableUntil }: AvailabilityProps) {
  const today = DAY_NAMES[new Date().getDay()];
  const todayHours = schedule?.[today];
  const isAvailableNow = availableUntil ? new Date(availableUntil) > new Date() : false;

  // Nothing to show if no schedule and not currently available
  if (!todayHours && !isAvailableNow) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-4 mt-4"
    >
      <div className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3",
        isAvailableNow
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-gray-200 bg-white"
      )}>
        <div className={cn(
          "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
          isAvailableNow
            ? "bg-emerald-400/15"
            : "bg-gray-100"
        )}>
          <CalendarDays size={16} className={isAvailableNow ? "text-emerald-400" : "text-slate-500"} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-[13px] font-semibold",
            isAvailableNow ? "text-emerald-400" : "text-slate-800"
          )}>
            {isAvailableNow ? "Available now" : `Today: ${todayHours}`}
          </p>
          {isAvailableNow && todayHours && (
            <p className="text-[11px] text-slate-400">Today&apos;s hours: {todayHours}</p>
          )}
          {!isAvailableNow && (
            <p className="text-[11px] text-slate-400 capitalize">{today}&apos;s schedule</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Share Strip ─────────────────────────────────────────────────────────────

type ShareProps = {
  username: string;
};

export function ShareStrip({ username }: ShareProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/u/${username}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${username} on Cleopatra`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // User cancelled
    }
  }

  return (
    <div className="mx-4 mt-4 mb-2">
      <button
        onClick={handleShare}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-[12px] font-medium text-slate-400 transition-all hover:border-gray-300 hover:text-slate-600 active:scale-[0.99]"
      >
        {copied ? (
          <>
            <Check size={13} className="text-emerald-400" />
            <span className="text-emerald-400">Link copied!</span>
          </>
        ) : (
          <>
            <Share2 size={13} />
            Know someone who&apos;d love this profile? Share it
          </>
        )}
      </button>
    </div>
  );
}
