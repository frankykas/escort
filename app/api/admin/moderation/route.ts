import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getPendingExplicitContent, reviewExplicitContent } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

// GET  /api/admin/moderation → pending explicit posts awaiting review
// PATCH /api/admin/moderation → { postId, decision: 'approved'|'rejected' }

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const items = await getPendingExplicitContent();
  return NextResponse.json({ items });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { postId, decision } = await req.json();
  if (!postId || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await reviewExplicitContent(adminId, postId, decision);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
