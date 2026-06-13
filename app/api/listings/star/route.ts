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
  const { listingId } = body;

  if (!listingId) {
    return NextResponse.json({ error: "listingId is required" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("star_listing", {
    p_provider_id: providerId,
    p_listing_id: listingId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as {
    success: boolean;
    star_id?: string;
    credits_spent?: number;
    expires_at?: string;
    active_stars_in_city?: number;
    error?: string;
    slots_full?: boolean;
    next_available?: string;
  };

  if (!result.success) {
    return NextResponse.json(
      {
        error: result.error ?? "Failed to star listing",
        slotsFull: result.slots_full ?? false,
        nextAvailable: result.next_available ?? null,
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    starId: result.star_id,
    creditsSpent: result.credits_spent,
    expiresAt: result.expires_at,
    activeStarsInCity: result.active_stars_in_city,
  });
}

// GET: Check star status + slot availability
export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const city = req.nextUrl.searchParams.get("city");
  if (!city) {
    return NextResponse.json({ error: "city is required" }, { status: 400 });
  }

  const listingId = req.nextUrl.searchParams.get("listingId");

  // Fetch slot availability
  const { data: slotsData } = await supabase.rpc("get_star_slots", {
    p_city: city,
  });

  const slots = (slotsData as {
    active_count: number;
    max_slots: number;
    slots_available: number;
    next_available: string | null;
  }) ?? { active_count: 0, max_slots: 6, slots_available: 6, next_available: null };

  // Optionally check active star for a specific listing
  let star = null;
  if (listingId) {
    const { data } = await supabase
      .from("listing_stars")
      .select("id, listing_id, city, credits_spent, starred_at, expires_at")
      .eq("listing_id", listingId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("starred_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    star = data ?? null;
  }

  return NextResponse.json({ star, slots });
}
