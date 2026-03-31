"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const UPDATE_INTERVAL_MS = 1000 * 60 * 5; // 5 minutes

export function useLastActive(userId: string | undefined) {
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    async function update() {
      const now = Date.now();
      if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) return;

      lastUpdateRef.current = now;
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
    }

    // Initial update
    update();

    // Re-check periodically
    const id = setInterval(update, 60_000); // Check every minute
    return () => clearInterval(id);
  }, [userId]);
}
