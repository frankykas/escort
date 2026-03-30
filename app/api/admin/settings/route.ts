import { NextRequest, NextResponse } from "next/server";
import { updatePlatformSetting, getAdminAuditLog } from "@/lib/admin";

// Update a platform setting
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adminId, key, value } = body;

  if (!adminId || !key || value === undefined) {
    return NextResponse.json(
      { error: "adminId, key, and value are required" },
      { status: 400 }
    );
  }

  const result = await updatePlatformSetting(adminId, key, value);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// Get audit log
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") ?? 50);
  const offset = Number(searchParams.get("offset") ?? 0);

  const log = await getAdminAuditLog(limit, offset);
  return NextResponse.json(log);
}
