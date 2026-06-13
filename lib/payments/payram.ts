import { timingSafeEqual } from "crypto";
import type { CheckoutParams, CheckoutResult } from "@/lib/payments";

// ---------------------------------------------------------------------------
// Payram provider — self-hosted crypto payment gateway.
//
// Contract (docs.payram.com/api-integration/payments-api):
//   POST {PAYRAM_API_URL}/api/v1/payment
//     headers: API-Key, Content-Type: application/json
//     body:    { customerEmail, customerID, amountInUSD }
//     resp:    { host, reference_id, url }
//
// Webhook: Payram POSTs { customer_id, invoice_id, reference_id, status,
//   amount, currency, filled_amount, filled_amount_in_usd, timestamp } to the
//   configured URL and includes the API-Key header for verification.
//
// NOTE: amountInUSD is USD. We treat stored minor units as USD cents for now;
// proper FX (tiers display CA$) is a documented follow-up.
//
// Env:
//   PAYRAM_API_URL      e.g. https://your-host:8443   (no trailing slash)
//   PAYRAM_API_KEY      project API key (auth for create-payment)
//   PAYRAM_WEBHOOK_KEY  expected inbound webhook API-Key (defaults to PAYRAM_API_KEY)
// ---------------------------------------------------------------------------

interface PayramPaymentResponse {
  host?: string;
  reference_id?: string;
  url?: string;
}

export async function createPayramCheckout(
  params: CheckoutParams
): Promise<CheckoutResult> {
  const base = process.env.PAYRAM_API_URL;
  const apiKey = process.env.PAYRAM_API_KEY;

  if (!base || !apiKey) {
    throw new Error("PAYRAM_API_URL and PAYRAM_API_KEY must be set");
  }

  const res = await fetch(`${base.replace(/\/$/, "")}/api/v1/payment`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerEmail: params.customerEmail,
      customerID: params.customerId,
      // Payram expects a USD amount, not minor units.
      amountInUSD: params.amountCents / 100,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Payram create-payment failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as PayramPaymentResponse;
  if (!data.url || !data.reference_id) {
    throw new Error("Payram response missing url or reference_id");
  }

  return { url: data.url, providerRef: data.reference_id };
}

/**
 * Verifies an inbound webhook by comparing the API-Key header (constant-time)
 * to the configured webhook key. If your Payram instance signs payloads with
 * HMAC-SHA256 instead, add that check here (the seam is intentional).
 */
export function verifyPayramWebhookKey(headerKey: string | null): boolean {
  const expected = process.env.PAYRAM_WEBHOOK_KEY || process.env.PAYRAM_API_KEY;
  if (!expected || !headerKey) return false;

  const a = Buffer.from(headerKey);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
