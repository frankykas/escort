import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  return NextResponse.json({ isAdmin: isAdmin(userId) });
}
