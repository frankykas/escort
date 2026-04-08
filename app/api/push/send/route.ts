import { NextRequest, NextResponse } from "next/server";
import { sendPushForNotification, type NotificationRow } from "@/lib/push-server";

/**
 * POST /api/push/send
 *
 * Webhook-triggered push dispatcher. Called by a Supabase Database Webhook
 * whenever a new row is inserted into `notifications`.
 *
 * Auth: Bearer token matching PUSH_WEBHOOK_SECRET.
 *
 * Supabase webhook body shape:
 *   { type: "INSERT", table: "notifications", record: {...}, schema: "public" }
 */
export async function POST(req: NextRequest) {
  // 1. Verify webhook secret
  const secret = process.env.PUSH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "PUSH_WEBHOOK_SECRET not configured" }, { status: 500 });
  }

  const authHeader = req.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse payload
  let body: { type?: string; table?: string; record?: NotificationRow };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type !== "INSERT" || body.table !== "notifications" || !body.record) {
    return NextResponse.json({ ok: true, skipped: "not a notification insert" });
  }

  const record = body.record;
  if (!record.recipient_id || !record.type || !record.title) {
    return NextResponse.json({ ok: true, skipped: "missing required fields" });
  }

  // 3. Dispatch push
  try {
    const result = await sendPushForNotification(record);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Push send error:", err);
    return NextResponse.json({ error: "Failed to send push" }, { status: 500 });
  }
}
