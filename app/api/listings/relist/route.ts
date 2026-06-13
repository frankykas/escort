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

  const { listingId } = await req.json();

  if (!listingId) {
    return NextResponse.json(
      { error: "listingId is required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase.rpc("relist_listing", {
    p_provider_id: providerId,
    p_listing_id: listingId,
    p_duration_hours: 24,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { success: boolean; error?: string };

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Failed to relist" },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
