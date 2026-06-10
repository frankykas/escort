import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { getPaymentProvider, type PaymentPurpose } from "@/lib/payments";
import { USE_CREATOR_CONTENT } from "@/lib/features";

// ---------------------------------------------------------------------------
// POST /api/payments/create
//
// Body: { purpose: 'subscription'|'ppv'|'message'|'tip', referenceId: uuid, amountCents?: number }
//   • subscription → referenceId = subscription_tiers.id
//   • ppv          → referenceId = status_updates.id (premium + priced)
//   • message      → referenceId = chat_messages.id (locked + priced; payer must be a channel member)
//   • tip          → referenceId = creator profile id; amountCents required
//
// The amount is ALWAYS derived server-side from the DB (except tips, which are
// validated against bounds). Creates a pending `payments` row, opens a Payram
// checkout, stores Payram's reference_id, and returns the hosted page URL.
// ---------------------------------------------------------------------------

const TIP_MIN_CENTS = 100;          // $1
const TIP_MAX_CENTS = 1_000_000;    // $10,000

export async function POST(req: NextRequest) {
  if (!USE_CREATOR_CONTENT) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const payerId = auth.user.id;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const purpose = body.purpose as PaymentPurpose;
  const referenceId = body.referenceId as string | undefined;

  if (!["subscription", "ppv", "message", "stream", "bundle", "tip"].includes(purpose) || !referenceId) {
    return NextResponse.json({ error: "Invalid purpose or referenceId" }, { status: 400 });
  }

  // --- Resolve amount + creator, server-side ---
  let amountCents: number;

  if (purpose === "subscription") {
    const { data: tier } = await supabase
      .from("subscription_tiers")
      .select("provider_id, monthly_rate, is_active")
      .eq("id", referenceId)
      .maybeSingle();

    if (!tier || !tier.is_active) {
      return NextResponse.json({ error: "Subscription tier unavailable" }, { status: 404 });
    }
    if (tier.provider_id === payerId) {
      return NextResponse.json({ error: "You cannot subscribe to yourself" }, { status: 400 });
    }
    amountCents = tier.monthly_rate;

  } else if (purpose === "ppv") {
    const { data: post } = await supabase
      .from("status_updates")
      .select("provider_id, is_premium, unlock_price")
      .eq("id", referenceId)
      .maybeSingle();

    if (!post || !post.is_premium || post.unlock_price == null) {
      return NextResponse.json({ error: "Post is not available for purchase" }, { status: 404 });
    }
    if (post.provider_id === payerId) {
      return NextResponse.json({ error: "You already own this content" }, { status: 400 });
    }
    amountCents = post.unlock_price;

  } else if (purpose === "message") {
    const { data: message } = await supabase
      .from("chat_messages")
      .select("sender_id, channel_id, is_locked, unlock_price")
      .eq("id", referenceId)
      .maybeSingle();

    if (!message || !message.is_locked || message.unlock_price == null) {
      return NextResponse.json({ error: "Message is not available for purchase" }, { status: 404 });
    }
    if (message.sender_id === payerId) {
      return NextResponse.json({ error: "You sent this message" }, { status: 400 });
    }
    // The payer must be a member of the message's channel.
    const { data: membership } = await supabase
      .from("chat_channel_members")
      .select("channel_id")
      .eq("channel_id", message.channel_id)
      .eq("user_id", payerId)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this conversation" }, { status: 403 });
    }
    amountCents = message.unlock_price;

  } else if (purpose === "stream") {
    const { data: stream } = await supabase
      .from("live_streams")
      .select("creator_id, ticket_price, status")
      .eq("id", referenceId)
      .maybeSingle();

    if (!stream || stream.status === "ended" || stream.ticket_price <= 0) {
      return NextResponse.json({ error: "Stream ticket unavailable" }, { status: 404 });
    }
    if (stream.creator_id === payerId) {
      return NextResponse.json({ error: "You are hosting this show" }, { status: 400 });
    }
    amountCents = stream.ticket_price;

  } else if (purpose === "bundle") {
    const { data: bundle } = await supabase
      .from("bundles")
      .select("monthly_price, is_active")
      .eq("id", referenceId)
      .maybeSingle();

    if (!bundle || !bundle.is_active) {
      return NextResponse.json({ error: "Bundle unavailable" }, { status: 404 });
    }
    amountCents = bundle.monthly_price;

  } else {
    // tip — amount supplied by the client, validated against bounds.
    const tip = Number(body.amountCents);
    if (!Number.isInteger(tip) || tip < TIP_MIN_CENTS || tip > TIP_MAX_CENTS) {
      return NextResponse.json({ error: "Invalid tip amount" }, { status: 400 });
    }
    const { data: creator } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", referenceId)
      .maybeSingle();
    if (!creator) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }
    if (creator.id === payerId) {
      return NextResponse.json({ error: "You cannot tip yourself" }, { status: 400 });
    }
    amountCents = tip;
  }

  // --- Record a pending payment ---
  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      payer_id: payerId,
      purpose,
      reference_id: referenceId,
      amount: amountCents,
      currency: "usd",
      provider: "payram",
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return NextResponse.json({ error: "Could not create payment" }, { status: 500 });
  }

  // --- Open the Payram checkout ---
  try {
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckout({
      paymentId: payment.id,
      customerId: payerId,
      customerEmail: auth.user.email ?? "",
      amountCents,
    });

    await supabase
      .from("payments")
      .update({ provider_ref: checkout.providerRef })
      .eq("id", payment.id);

    return NextResponse.json({ url: checkout.url, paymentId: payment.id });
  } catch (err) {
    await supabase.from("payments").update({ status: "failed" }).eq("id", payment.id);
    const message = err instanceof Error ? err.message : "Payment provider error";
    console.error("[payram] create checkout failed:", message);
    return NextResponse.json({ error: "Payment provider unavailable" }, { status: 502 });
  }
}
