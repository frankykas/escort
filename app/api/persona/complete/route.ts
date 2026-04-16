import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

/**
 * POST /api/persona/complete
 *
 * Called by the client after the Persona Embedded Flow completes.
 * Stores the inquiry ID + status and sets verification_status to "pending"
 * (or "verified" if Persona auto-approved).
 *
 * Body: { inquiryId: string, status: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { inquiryId, status } = body;

  if (!inquiryId || !status) {
    return NextResponse.json(
      { error: "inquiryId and status are required" },
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
