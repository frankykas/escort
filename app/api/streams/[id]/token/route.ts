import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createStreamToken, getLiveKitWsUrl } from "@/lib/livekit";
import { getStream, hasStreamTicket } from "@/lib/streams";
import { USE_LIVE_SHOWS } from "@/lib/features";

// GET /api/streams/[id]/token
// Host → publish (A/V) token. Ticket holder (or free show) → subscribe token.
// Otherwise 403 with reason 'ticket'.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!USE_LIVE_SHOWS) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const stream = await getStream(id);
  if (!stream) return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  if (stream.status === "ended") {
    return NextResponse.json({ error: "Stream has ended" }, { status: 410 });
  }

  const isHost = stream.creator_id === userId;

  if (!isHost && stream.ticket_price > 0) {
    const ticket = await hasStreamTicket(userId, id);
    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket required", reason: "ticket", ticketPrice: stream.ticket_price },
        { status: 403 }
      );
    }
  }

  try {
    const token = await createStreamToken(userId, stream.room_name, isHost);
    return NextResponse.json({ token, wsUrl: getLiveKitWsUrl(), isHost });
  } catch (err) {
    console.error("[streams/token] generation failed:", err);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
