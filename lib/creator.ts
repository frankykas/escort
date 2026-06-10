import { createServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Creator earnings & payouts — server-side helpers.
//
// Balances are maintained by confirm_payram_payment (credits `pending`) and
// mature_creator_balances (pending → available after the hold window). Payouts
// draw from `available` via the request_payout RPC.
// ---------------------------------------------------------------------------

export interface CreatorBalance {
  available: number; // cents, withdrawable now
  pending: number;   // cents, within hold window
  lifetime: number;  // cents, gross ever earned
}

export interface Payout {
  id: string;
  amount: number;
  status: "requested" | "processing" | "paid" | "failed";
  requested_at: string;
  paid_at: string | null;
}

export async function getCreatorBalance(creatorId: string): Promise<CreatorBalance> {
  const supabase = createServerClient();
  const empty = { available: 0, pending: 0, lifetime: 0 };
  if (!supabase) return empty;

  const { data } = await supabase
    .from("creator_balances")
    .select("available, pending, lifetime")
    .eq("creator_id", creatorId)
    .maybeSingle();

  return data ?? empty;
}

export async function getPayouts(creatorId: string): Promise<Payout[]> {
  const supabase = createServerClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("payouts")
    .select("id, amount, status, requested_at, paid_at")
    .eq("creator_id", creatorId)
    .order("requested_at", { ascending: false });

  return (data ?? []) as Payout[];
}

export interface RequestPayoutResult {
  success: boolean;
  payoutId?: string;
  error?: string;
}

/**
 * Requests a payout for the given (already-authenticated) creator. The
 * underlying RPC is atomic and rejects amounts exceeding the available balance.
 */
export async function requestPayout(
  creatorId: string,
  amountCents: number,
  destination?: Record<string, unknown>
): Promise<RequestPayoutResult> {
  const supabase = createServerClient();
  if (!supabase) return { success: false, error: "Database unavailable" };

  const { data, error } = await supabase.rpc("request_payout", {
    p_creator_id: creatorId,
    p_amount: amountCents,
    p_destination: destination ?? null,
  });

  if (error) return { success: false, error: error.message };
  if (data === "insufficient") return { success: false, error: "Insufficient available balance" };
  if (data === "invalid") return { success: false, error: "Invalid payout amount" };

  return { success: true, payoutId: data as string };
}
