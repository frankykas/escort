import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ isAdmin: false });
  return NextResponse.json({ isAdmin: isAdmin(auth.user.id) });
}
