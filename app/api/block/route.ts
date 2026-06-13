import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

// POST — Block a user
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const blockerId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { blockedId } = await req.json();
  if (!blockedId) {
    return NextResponse.json({ error: "blockedId required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });

  if (error) {
    if (error.code === "23505") return NextResponse.json({ ok: true }); // already blocked
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also reject any pending request from the blocked user
  await supabase
    .from("message_requests")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("sender_id", blockedId)
    .eq("recipient_id", blockerId)
    .eq("status", "pending");

  return NextResponse.json({ ok: true });
}

// DELETE — Unblock a user
export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const blockerId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const { blockedId } = await req.json();
  if (!blockedId) {
    return NextResponse.json({ error: "blockedId required" }, { status: 400 });
  }

  await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);

  return NextResponse.json({ ok: true });
}

// GET — Check if a user is blocked.
// Caller must be one of the two parties (verified via session).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const blockerId = req.nextUrl.searchParams.get("blockerId");
  const blockedId = req.nextUrl.searchParams.get("blockedId");

  if (!blockerId || !blockedId) {
    return NextResponse.json({ error: "blockerId and blockedId required" }, { status: 400 });
  }

  // Only allow checking blocks involving yourself
  if (auth.user.id !== blockerId && auth.user.id !== blockedId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data } = await supabase
    .from("blocked_users")
    .select("id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();

  return NextResponse.json({ blocked: !!data });
}
