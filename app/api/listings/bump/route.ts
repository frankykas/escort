import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const providerId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const body = await req.json();
  const { listingId, tier } = body;

  if (!listingId || !tier) {
    return NextResponse.json(
      { error: "listingId and tier are required" },
      { status: 400 },
    );
  }

  if (![1, 2, 3].includes(tier)) {
    return NextResponse.json(
      { error: "tier must be 1, 2, or 3" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("bump_listing", {
    p_provider_id: providerId,
    p_listing_id: listingId,
    p_tier: tier,
    p_duration_hours: 24,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    success: boolean;
    bump_id?: string;
    tier?: number;
    credits_spent?: number;
    expires_at?: string;
    error?: string;
  };

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to bump listing" },
      { status: 403 },
    );
  }

  return NextResponse.json({
    bumpId: result.bump_id,
    tier: result.tier,
    creditsSpent: result.credits_spent,
    expiresAt: result.expires_at,
  });
}

// GET: Check active bump status for a listing
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const listingId = req.nextUrl.searchParams.get("listingId");
  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  const { data } = await supabase
    .from("listing_bumps")
    .select("id, tier, credits_spent, bumped_at, expires_at")
    .eq("listing_id", listingId)
    .eq("is_active", true)
    .gt("expires_at", new Date().toISOString())
    .order("bumped_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ bump: data ?? null });
}
