// ---------------------------------------------------------------------------
// Provider-agnostic payments interface.
//
// Creator-content flows (subscriptions, PPV, tips) go through this interface so
// the underlying processor is swappable. The current implementation is Payram
// (self-hosted crypto gateway). Stripe stays wired separately for non-adult
// flows (listing bumps, posting packages) and is intentionally NOT routed here.
// ---------------------------------------------------------------------------

import { createPayramCheckout, verifyPayramWebhookKey } from "@/lib/payments/payram";

export type PaymentPurpose = "subscription" | "ppv" | "message" | "stream" | "bundle" | "tip";

export interface CheckoutParams {
  /** Our payments.id — for correlation/logging on our side. */
  paymentId: string;
  /** Payer user id → sent to the provider as the customer id. */
  customerId: string;
  customerEmail: string;
  /** Amount in integer minor units (cents). */
  amountCents: number;
}

export interface CheckoutResult {
  /** Hosted payment page the client is redirected to. */
  url: string;
  /** Provider's own reference for this payment (mapped back by the webhook). */
  providerRef: string;
}

export interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  /** Verifies an inbound webhook from the value of its auth header. */
  verifyWebhook(headerKey: string | null): boolean;
}

const payram: PaymentProvider = {
  createCheckout: createPayramCheckout,
  verifyWebhook: verifyPayramWebhookKey,
};

/** Returns the active payment provider for creator-content flows. */
export function getPaymentProvider(): PaymentProvider {
  return payram;
}
