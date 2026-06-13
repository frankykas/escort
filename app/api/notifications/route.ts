import { NextRequest, NextResponse } from "next/server";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from "@/lib/notifications";
import { requireUser } from "@/lib/api-auth";

// Get notifications or unread count
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { searchParams } = new URL(req.url);
  const view = searchParams.get("view") ?? "list"; // "list" | "count"

  if (view === "count") {
    const count = await getUnreadCount(userId);
    return NextResponse.json({ count });
  }

  const limit = Number(searchParams.get("limit") ?? 30);
  const offset = Number(searchParams.get("offset") ?? 0);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const notifications = await getNotifications(userId, limit, offset, unreadOnly);
  return NextResponse.json(notifications);
}

// Mark as read / mark all as read / delete
export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { action, notificationId } = body;

  if (action === "read" && notificationId) {
    await markAsRead(notificationId);
    return NextResponse.json({ ok: true });
  }

  if (action === "read_all") {
    await markAllAsRead(userId);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete" && notificationId) {
    await deleteNotification(notificationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
