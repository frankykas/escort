import { NextRequest, NextResponse } from "next/server";
import { isAdmin, approveVerification, rejectVerification } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

/**
 * PATCH /api/admin/verification
 *
 * Approve or reject a pending verification request.
 * Body: { userId: string, action: "approve" | "reject", reason?: string }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, action, reason } = body;

  if (!userId || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "userId and action (approve|reject) are required" },
      { status: 400 }
    );
  }

  const result =
    action === "approve"
      ? await approveVerification(adminId, userId)
      : await rejectVerification(adminId, userId, reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
