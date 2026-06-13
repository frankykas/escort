import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createServerClient } from "@/lib/supabase/server";
import { createStream, getLiveStreams } from "@/lib/streams";
import { USE_LIVE_SHOWS } from "@/lib/features";

// GET  /api/streams        → currently-live shows
// POST /api/streams        → start a show { title, ticketPriceCents? } (providers)

export async function GET() {
  if (!USE_LIVE_SHOWS) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const streams = await getLiveStreams();
  return NextResponse.json({ streams });
}

export async function POST(req: NextRequest) {
  if (!USE_LIVE_SHOWS) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const supabase = createServerClient();
  if (!supabase) return NextResponse.json({ error: "Database unavailable" }, { status: 500 });

  // Only providers can broadcast.
  const { data: profile } = await supabase
    .from("profiles")
    .select("provider_type")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (!profile?.provider_type) {
    return NextResponse.json({ error: "Only providers can go live" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title : "";
  if (!title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const ticketPriceCents = Number.isFinite(Number(body.ticketPriceCents))
    ? Math.max(0, Math.round(Number(body.ticketPriceCents)))
    : 0;

  const result = await createStream(auth.user.id, title, ticketPriceCents);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ stream: result.stream });
}
