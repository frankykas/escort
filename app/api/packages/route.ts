import { NextRequest, NextResponse } from "next/server";
import {
  getPostingPackages,
  getCreditBalance,
  getPurchaseHistory,
} from "@/lib/packages";
import { requireUser } from "@/lib/api-auth";

// Get available packages + optionally the caller's balance/history.
// Balance/history is only ever returned for the authenticated user — this
// route never reveals another provider's credit state.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeOwn = searchParams.get("includeOwn") === "1" || searchParams.has("providerId");

  const packages = await getPostingPackages();

  if (includeOwn) {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;
    const providerId = auth.user.id;

    const [balance, history] = await Promise.all([
      getCreditBalance(providerId),
      getPurchaseHistory(providerId),
    ]);

    return NextResponse.json({ packages, balance, history });
  }

  return NextResponse.json({ packages });
}
