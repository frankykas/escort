import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// POST /api/webhooks/payram
//
// Payram posts payment lifecycle events here. Payload:
//   { customer_id, invoice_id, reference_id, status, amount, currency,
//     filled_amount, filled_amount_in_usd, timestamp }
// Verified via the API-Key header. On a confirmed payment we call the
// idempotent confirm_payram_payment RPC, which applies all side effects
// (activate subscription / record PPV unlock / credit creator balance).
//
// Always return 200 for already-handled or unknown references so Payram stops
// retrying; return non-2xx only on transient/server errors so it retries.
// ---------------------------------------------------------------------------

// Payram emits: "Payment Page Rendered", "Payment Detected on Network",
// "Payment Confirmed". We only act on confirmation. The exact status string can
// vary by version, so match defensively.
function isConfirmed(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const s = status.toLowerCase();
  return s.includes("confirm") || s.includes("complete") || s.includes("success") || s === "paid";
}

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider();

  if (!provider.verifyWebhook(req.headers.get("api-key"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const referenceId = payload.reference_id as string | undefined;
  if (!referenceId) {
    return NextResponse.json({ error: "Missing reference_id" }, { status: 400 });
  }

  // Acknowledge non-confirmation events without acting on them.
  if (!isConfirmed(payload.status)) {
    return NextResponse.json({ received: true, acted: false });
  }

  const supabase = createServerClient();
  if (!supabase) {
    // Transient: let Payram retry.
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const filledUsd =
    payload.filled_amount_in_usd != null ? Number(payload.filled_amount_in_usd) : null;

  const { data: result, error } = await supabase.rpc("confirm_payram_payment", {
    p_reference_id: referenceId,
    p_filled_usd: filledUsd,
  });

  if (error) {
    console.error("[payram] confirm RPC failed:", error.message);
    // Transient: let Payram retry.
    return NextResponse.json({ error: "Could not process" }, { status: 503 });
  }

  // result ∈ unknown | already | underpaid | confirmed — all are 200s.
  return NextResponse.json({ received: true, result });
}
