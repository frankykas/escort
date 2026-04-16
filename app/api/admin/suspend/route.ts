import { NextRequest, NextResponse } from "next/server";
import { suspendPosting, unsuspendPosting, isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { providerId, action, reason } = body;

  if (!providerId || !action) {
    return NextResponse.json(
      { error: "providerId and action are required" },
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
