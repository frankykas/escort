import { NextRequest, NextResponse } from "next/server";
import { isAdmin, getBundles, createBundle, setBundleActive } from "@/lib/admin";
import { requireUser } from "@/lib/api-auth";

// GET   /api/admin/bundles → all bundles
// POST  /api/admin/bundles → create { name, description?, monthlyPriceCents }
// PATCH /api/admin/bundles → toggle { bundleId, isActive }

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const bundles = await getBundles();
  return NextResponse.json({ bundles });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description, monthlyPriceCents } = await req.json();
  if (!name?.trim() || !Number.isInteger(monthlyPriceCents) || monthlyPriceCents <= 0) {
    return NextResponse.json({ error: "Invalid bundle" }, { status: 400 });
  }

  const result = await createBundle(auth.user.id, { name, description, monthlyPriceCents });
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  if (!isAdmin(auth.user.id)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { bundleId, isActive } = await req.json();
  if (!bundleId || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const result = await setBundleActive(auth.user.id, bundleId, isActive);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
