import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const providerId = auth.user.id;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 }
    );
  }

  const { packageId } = await req.json();
  if (!packageId) {
    return NextResponse.json(
      { error: "packageId is required" },
      { status: 400 }
    );
  }

  // Look up the package
  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  const { data: pkg } = await supabase
    .from("posting_packages")
    .select("id, name, description, post_credits, price")
    .eq("id", packageId)
    .eq("is_active", true)
    .single();

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Create Stripe Checkout Session
  const origin = req.headers.get("origin") ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "cad",
          unit_amount: pkg.price, // already in cents
          product_data: {
            name: pkg.name,
            description: `${pkg.post_credits} post credits${pkg.description ? ` — ${pkg.description}` : ""}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      package_id: pkg.id,
      provider_id: providerId,
      credits: String(pkg.post_credits),
    },
    success_url: `${origin}/profile/packages?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/profile/packages?cancelled=1`,
  });

  return NextResponse.json({ url: session.url });
}
