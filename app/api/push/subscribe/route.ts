import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/push/subscribe
 *
 * Called by the client after the browser returns a push subscription.
 * Upserts the subscription row for the given user.
 *
 * Body: { userId, endpoint, p256dh, auth, userAgent? }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { userId, endpoint, p256dh, auth, userAgent } = await req.json();

  if (!userId || !endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "userId, endpoint, p256dh, and auth are required" },
      { status: 400 }
    );
  }

  // Upsert by endpoint — re-subscribing from the same device replaces the row
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent ?? null,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

  if (error) {
    console.error("Push subscribe error:", error.message);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
