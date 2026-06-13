import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { endStream } from "@/lib/streams";
import { USE_LIVE_SHOWS } from "@/lib/features";

// POST /api/streams/[id]/end → host ends their show.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!USE_LIVE_SHOWS) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const result = await endStream(auth.user.id, id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
