import { NextRequest, NextResponse } from "next/server";
import { createPackage, deactivatePackage } from "@/lib/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { adminId, action } = body;

  if (!adminId || !action) {
    return NextResponse.json({ error: "adminId and action are required" }, { status: 400 });
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
