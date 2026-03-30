import { NextRequest, NextResponse } from "next/server";
import { suspendPosting, unsuspendPosting } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adminId, providerId, action, reason } = body;

  if (!adminId || !providerId || !action) {
    return NextResponse.json(
      { error: "adminId, providerId, and action are required" },
      { status: 400 }
    );
  }

  if (action === "suspend") {
    const result = await suspendPosting(adminId, providerId, reason ?? "No reason provided");
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "unsuspend") {
    const result = await unsuspendPosting(adminId, providerId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'suspend' or 'unsuspend'" }, { status: 400 });
}
