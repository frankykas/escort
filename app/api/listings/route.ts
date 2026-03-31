import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const body = await req.json();
  const {
    providerId, title, description, durationMinutes,
    rate, serviceType, perks, durationHours,
  } = body;

  if (!providerId || !title) {
    return NextResponse.json(
      { error: "providerId and title are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("create_listing_with_credit", {
    p_provider_id: providerId,
    p_title: title,
    p_description: description || null,
    p_duration_minutes: durationMinutes || null,
    p_rate: rate || null,
    p_service_type: serviceType || null,
    p_perks: perks || [],
    p_duration_hours: durationHours || 24,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { success: boolean; listing_id?: string; error?: string };

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to create listing" },
      { status: 403 }
    );
  }

  return NextResponse.json({ listingId: result.listing_id });
}
