import { loadStripe, type Stripe } from "@stripe/stripe-js";

let _promise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!_promise) {
    _promise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
    );
  }
  return _promise;
}
