import { NextRequest, NextResponse } from "next/server";
import {
  getPostingPackages,
  getCreditBalance,
  getPurchaseHistory,
  recordPackagePurchase,
} from "@/lib/packages";

// Get available packages + optionally a provider's balance/history
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");

  const packages = await getPostingPackages();

  if (providerId) {
    const [balance, history] = await Promise.all([
      getCreditBalance(providerId),
      getPurchaseHistory(providerId),
    ]);

    return NextResponse.json({ packages, balance, history });
  }

  return NextResponse.json({ packages });
}

// Record a purchase (called after Stripe webhook confirms payment)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { providerId, packageId, stripePaymentIntentId } = body;

  if (!providerId || !packageId || !stripePaymentIntentId) {
    return NextResponse.json(
      { error: "providerId, packageId, and stripePaymentIntentId are required" },
      { status: 400 }
    );
  }

  const result = await recordPackagePurchase(providerId, packageId, stripePaymentIntentId);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ purchaseId: result.purchaseId });
}
