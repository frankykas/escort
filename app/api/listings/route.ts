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
  const {
    title, description, durationMinutes,
    rate, serviceType, perks, durationHours,
  } = body;

  if (!title) {
    return NextResponse.json(
      { error: "title is required" },
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
