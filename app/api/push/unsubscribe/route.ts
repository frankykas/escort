import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

/**
 * POST /api/push/unsubscribe
 *
 * Removes a push subscription row for the authenticated user.
 * Body: { endpoint }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { endpoint } = await req.json();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
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
