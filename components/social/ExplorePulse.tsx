"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/en";
import type { ExplorePulse as PulseData } from "@/app/api/explore/pulse/route";

const REFRESH_MS = 30_000;   // re-fetch live counts every 30s
const ROTATE_MS  = 4_500;    // cycle the visible message every 4.5s

type Props = {
  city: string | null;
};

function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function ExplorePulse({ city }: Props) {
  const { t } = useTranslation();
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [idx, setIdx] = useState(0);
  const cancelledRef = useRef(false);

  // Fetch + refresh
  useEffect(() => {
    cancelledRef.current = false;

    async function load() {
      try {
        const url = city ? `/api/explore/pulse?city=${encodeURIComponent(city)}` : "/api/explore/pulse";
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok) return;
        const data: PulseData = await r.json();
        if (!cancelledRef.current) setPulse(data);
      } catch {
        /* swallow — pulse is decorative, never block UI */
      }
    }

    load();
    const iv = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelledRef.current = true;
      window.clearInterval(iv);
    };
  }, [city]);

  // Build the rotating set of messages from whatever data is available.
  const messages = useMemo(() => {
    const out: string[] = [];
    if (!pulse) return out;

    if (pulse.onlineCount > 0) {
      out.push(
        pulse.city
          ? fmt(t("pulse_online_city" as TranslationKey), { n: pulse.onlineCount, city: pulse.city })
          : fmt(t("pulse_online_global" as TranslationKey), { n: pulse.onlineCount })
      );
    }

    if (pulse.newToday > 0) {
      out.push(
        pulse.city
          ? fmt(t("pulse_new_today_city" as TranslationKey), { n: pulse.newToday, city: pulse.city })
          : fmt(t("pulse_new_today_global" as TranslationKey), { n: pulse.newToday })
      );
    }

    if (pulse.latestEvent) {
      const key: TranslationKey =
        pulse.latestEvent.kind === "star"  ? "pulse_event_star"
      : pulse.latestEvent.kind === "post"  ? "pulse_event_post"
      :                                      "pulse_event_online";
      out.push(fmt(t(key), { name: pulse.latestEvent.username }));
    }

    if (out.length === 0) out.push(t("pulse_idle" as TranslationKey));

    return out;
  }, [pulse, t]);

  // Rotate messages
  useEffect(() => {
    if (messages.length <= 1) return;
    const iv = window.setInterval(() => {
      setIdx((i) => (i + 1) % messages.length);
    }, ROTATE_MS);
    return () => window.clearInterval(iv);
  }, [messages.length]);

  // Reset index when the message set changes (e.g. city change)
  useEffect(() => { setIdx(0); }, [messages.length]);

  if (messages.length === 0) {
    // Reserve the strip's height so layout doesn't jump when data lands.
    return <div className="h-7" aria-hidden />;
  }

  const current = messages[Math.min(idx, messages.length - 1)];

  return (
    <div className="flex items-center justify-center gap-2 px-4 pt-1 pb-2">
      {/* Pulse dot */}
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" />
      </span>

      {/* Rotating message */}
      <div className="relative h-4 flex-1 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={current}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="absolute inset-0 truncate text-[12px] font-medium bg-gradient-to-r from-pink-500 to-sky-400 bg-clip-text text-transparent"
          >
            {current}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
