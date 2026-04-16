import { NextRequest, NextResponse } from "next/server";
import { createPackage, deactivatePackage, isAdmin } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const adminId = auth.user.id;
  if (!isAdmin(adminId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  if (action === "create") {
    const { name, description, postCredits, price, validityDays, sortOrder } = body;
    if (!name || !postCredits || !price) {
      return NextResponse.json(
        { error: "name, postCredits, and price are required" },
        { status: 400 }
      );
    }

    const result = await createPackage(adminId, {
      name,
      description,
      postCredits,
      price,
      validityDays,
      sortOrder,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "deactivate") {
    const { packageId } = body;
    if (!packageId) {
      return NextResponse.json({ error: "packageId is required" }, { status: 400 });
    }

    const result = await deactivatePackage(adminId, packageId);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "action must be 'create' or 'deactivate'" }, { status: 400 });
}
