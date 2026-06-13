import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getCreatorBalance, getPayouts, requestPayout } from "@/lib/creator";
import { USE_CREATOR_CONTENT } from "@/lib/features";

// ---------------------------------------------------------------------------
// GET  /api/payouts  → { balance, payouts }
// POST /api/payouts  → request a payout  { amountCents, destination? }
//
// Creator is always the authenticated caller — never trusted from the body.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  if (!USE_CREATOR_CONTENT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const [balance, payouts] = await Promise.all([
    getCreatorBalance(auth.user.id),
    getPayouts(auth.user.id),
  ]);

  return NextResponse.json({ balance, payouts });
}

export async function POST(req: NextRequest) {
  if (!USE_CREATOR_CONTENT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const amountCents = Number(body.amountCents);
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const destination =
    body.destination && typeof body.destination === "object" ? body.destination : undefined;

  const result = await requestPayout(auth.user.id, amountCents, destination);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ payoutId: result.payoutId });
}
