import { NextRequest, NextResponse } from "next/server";
import { grantCredits, isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { providerId, credits, reason } = body;

  if (!providerId || !credits || !reason) {
    return NextResponse.json(
      { error: "providerId, credits, and reason are required" },
      { status: 400 }
    );
  }

  const result = await grantCredits(adminId, providerId, credits, reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
