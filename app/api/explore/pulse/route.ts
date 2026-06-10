import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export type ExplorePulse = {
  onlineCount: number;
  newToday: number;
  latestEvent: {
    kind: "star" | "post" | "online";
    username: string;
    agoMin: number;
  } | null;
  city: string | null;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const city = (searchParams.get("city") ?? "").trim() || null;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("get_explore_pulse", { p_city: city });
  if (error) {
    console.error("[explore/pulse] RPC error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const ev = (row.latest_event as Record<string, unknown> | null) ?? null;

  const pulse: ExplorePulse = {
    onlineCount: (row.online_count as number) ?? 0,
    newToday:    (row.new_today    as number) ?? 0,
    latestEvent: ev
      ? {
          kind:     ev.kind as "star" | "post" | "online",
          username: ev.username as string,
          agoMin:   (ev.ago_min as number) ?? 0,
        }
      : null,
    city: (row.city as string | null) ?? null,
  };

  return NextResponse.json(pulse, {
    headers: { "Cache-Control": "no-store" },
  });
}
