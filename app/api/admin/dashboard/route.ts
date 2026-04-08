import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import {
  getDashboardStats,
  getRecentSignups,
  getPendingReports,
  getPendingVerifications,
} from "@/lib/admin";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [stats, recentUsers, reports, pendingVerifications] = await Promise.all([
    getDashboardStats(),
    getRecentSignups(15),
    getPendingReports(10),
    getPendingVerifications(20),
  ]);

  return NextResponse.json({ stats, recentUsers, reports, pendingVerifications });
}
