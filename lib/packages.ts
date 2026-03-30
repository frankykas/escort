import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PostingPackage {
  id: string;
  name: string;
  description: string | null;
  post_credits: number;
  price: number; // cents
  validity_days: number | null;
  sort_order: number;
}

interface PurchaseRecord {
  id: string;
  package_id: string;
  credits_purchased: number;
  credits_remaining: number;
  purchased_at: string;
  expires_at: string | null;
}

interface PurchaseResult {
  success: boolean;
  purchaseId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Get available posting packages
// ---------------------------------------------------------------------------

export async function getPostingPackages(): Promise<PostingPackage[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("posting_packages")
    .select("id, name, description, post_credits, price, validity_days, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (data ?? []) as PostingPackage[];
}

// ---------------------------------------------------------------------------
// Get provider's credit balance
// ---------------------------------------------------------------------------

export async function getCreditBalance(providerId: string): Promise<number> {
  const supabase = createServerClient();
  if (!supabase) return 0;

  const { data } = await supabase
    .from("profiles")
    .select("post_credits_balance")
    .eq("id", providerId)
    .single();

  return data?.post_credits_balance ?? 0;
}

// ---------------------------------------------------------------------------
// Get provider's purchase history
// ---------------------------------------------------------------------------

export async function getPurchaseHistory(providerId: string): Promise<PurchaseRecord[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("posting_package_purchases")
    .select("id, package_id, credits_purchased, credits_remaining, purchased_at, expires_at")
    .eq("provider_id", providerId)
    .order("purchased_at", { ascending: false });

  return (data ?? []) as PurchaseRecord[];
}

// ---------------------------------------------------------------------------
// Record a package purchase (called after Stripe payment succeeds)
// ---------------------------------------------------------------------------

export async function recordPackagePurchase(
  providerId: string,
  packageId: string,
  stripePaymentIntentId: string
): Promise<PurchaseResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  // Get the package details
  const { data: pkg } = await supabase
    .from("posting_packages")
    .select("post_credits, validity_days")
    .eq("id", packageId)
    .single();

  if (!pkg) {
    return { success: false, error: "Package not found" };
  }

  const expiresAt = pkg.validity_days
    ? new Date(Date.now() + pkg.validity_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data: purchase, error } = await supabase
    .from("posting_package_purchases")
    .insert({
      provider_id: providerId,
      package_id: packageId,
      credits_purchased: pkg.post_credits,
      credits_remaining: pkg.post_credits,
      stripe_payment_intent_id: stripePaymentIntentId,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, purchaseId: purchase.id };
}

// ---------------------------------------------------------------------------
// Format package price for display
// ---------------------------------------------------------------------------

export function formatPackagePrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Calculate price per post for display
// ---------------------------------------------------------------------------

export function pricePerPost(priceCents: number, credits: number): string {
  const perPost = priceCents / credits / 100;
  return `$${perPost.toFixed(2)}`;
}
