"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";

type ActivityState = "active" | "recent" | "offline";

type Props = {
  lastSeenAt?: string | null;
  availableUntil?: string | null;
  compact?: boolean;
  labelMode?: "default" | "short" | "hidden";
  className?: string;
};

function getDiffMinutes(lastSeenAt?: string | null): number | null {
  if (!lastSeenAt) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000));
}

function getState(lastSeenAt?: string | null, availableUntil?: string | null): ActivityState {
  if (availableUntil && new Date(availableUntil) > new Date()) return "active";
  if (!lastSeenAt) return "offline";

  const diffMinutes = getDiffMinutes(lastSeenAt) ?? Infinity;
  if (diffMinutes <= 5) return "active";
  if (diffMinutes <= 1440) return "recent";
  return "offline";
}

function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function formatSeen(
  lastSeenAt: string | null | undefined,
  short: boolean,
  t: (key: TranslationKey) => string,
): string {
  const diffMinutes = getDiffMinutes(lastSeenAt);
  if (diffMinutes == null) return t("activity_offline");

  let time: string;
  if (diffMinutes < 60) {
    time = interpolate(t("activity_time_min"), { n: diffMinutes });
  } else {
    const hours = Math.floor(diffMinutes / 60);
    if (hours < 24) {
      time = interpolate(t("activity_time_hour"), { n: hours });
    } else {
      const days = Math.floor(hours / 24);
      time = interpolate(t("activity_time_day"), { n: days });
    }
  }

  return interpolate(t(short ? "activity_seen_short" : "activity_seen_full"), { time });
}

export function ActivityIndicator({
  lastSeenAt,
  availableUntil,
  compact = false,
  labelMode,
  className,
}: Props) {
  const { t } = useTranslation();
  const state = getState(lastSeenAt, availableUntil);
  const resolvedLabelMode = labelMode ?? (compact ? "hidden" : "default");
  const label = state === "active"
    ? t("activity_online")
    : state === "recent"
    ? formatSeen(lastSeenAt, resolvedLabelMode === "short", t)
    : t("activity_offline");
  const title = state === "active" ? t("activity_online_now") : formatSeen(lastSeenAt, false, t);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        state === "active" && "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
        state === "recent" && "border-amber-400/25 bg-amber-400/10 text-amber-500",
        state === "offline" && "border-gray-200 bg-gray-50 text-slate-400",
        className
      )}
      title={title}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          state === "active" && "animate-pulse bg-emerald-400",
          state === "recent" && "bg-amber-400",
          state === "offline" && "bg-slate-300"
        )}
      />
      {resolvedLabelMode !== "hidden" && label}
    </span>
  );
}
