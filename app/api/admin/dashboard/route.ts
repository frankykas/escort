import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import {
  getDashboardStats,
  getRecentSignups,
  getPendingReports,
} from "@/lib/admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [stats, recentUsers, reports] = await Promise.all([
    getDashboardStats(),
    getRecentSignups(15),
    getPendingReports(10),
  ]);

  return NextResponse.json({ stats, recentUsers, reports });
}
