import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/push/unsubscribe
 *
 * Removes a push subscription row. Body: { userId, endpoint }
 */
export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { userId, endpoint } = await req.json();
  if (!userId || !endpoint) {
    return NextResponse.json({ error: "userId and endpoint required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", endpoint);

  if (error) {
    console.error("Push unsubscribe error:", error.message);
    return NextResponse.json({ error: "Failed to remove subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
