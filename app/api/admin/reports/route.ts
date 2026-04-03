import { NextRequest, NextResponse } from "next/server";
import { isAdmin, resolveReport } from "@/lib/admin";

export async function PATCH(req: NextRequest) {
  const { reportId, resolution, userId } = await req.json();

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!reportId || !["actioned", "dismissed"].includes(resolution)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await resolveReport(userId, reportId, resolution);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
