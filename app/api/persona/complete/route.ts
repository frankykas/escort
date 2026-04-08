import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * POST /api/persona/complete
 *
 * Called by the client after the Persona Embedded Flow completes.
 * Stores the inquiry ID + status and sets verification_status to "pending".
 *
 * Body: { userId: string, inquiryId: string, status: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userId, inquiryId, status } = body;

  if (!userId || !inquiryId || !status) {
    return NextResponse.json(
      { error: "userId, inquiryId, and status are required" },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Persona returns "completed" when documents + selfie match automatically.
  // Any other status (e.g. "needs_review") goes to the admin queue as "pending".
  const autoApproved = status === "completed";
  const verificationStatus = autoApproved ? "verified" : "pending";

  const updatePayload: Record<string, unknown> = {
    persona_inquiry_id: inquiryId,
    persona_status: status,
    verification_status: verificationStatus,
  };

  if (autoApproved) {
    updatePayload.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", userId);

  if (error) {
    console.error("Persona complete error:", error.message);
    return NextResponse.json(
      { error: "Failed to update verification status" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, verification_status: verificationStatus });
}
