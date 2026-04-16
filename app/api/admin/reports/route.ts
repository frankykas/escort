import { NextRequest, NextResponse } from "next/server";
import { isAdmin, resolveReport } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reportId, resolution } = await req.json();

  if (!reportId || !["actioned", "dismissed"].includes(resolution)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await resolveReport(adminId, reportId, resolution);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
