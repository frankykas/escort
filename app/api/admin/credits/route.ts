import { NextRequest, NextResponse } from "next/server";
import { grantCredits } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adminId, providerId, credits, reason } = body;

  if (!adminId || !providerId || !credits || !reason) {
    return NextResponse.json(
      { error: "adminId, providerId, credits, and reason are required" },
      { status: 400 }
    );
  }

  const result = await grantCredits(adminId, providerId, credits, reason);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
