import { NextRequest, NextResponse } from "next/server";
import {
  createMessageRequest,
  getMessageRequests,
  getRequestStatus,
  acceptMessageRequest,
  rejectMessageRequest,
} from "@/lib/chat";
import { requireUser } from "@/lib/api-auth";

// ---------------------------------------------------------------------------
// POST — Create a message request
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const senderId = auth.user.id;

  const body = await req.json();
  const { recipientId, introMessage } = body;

  if (!recipientId) {
    return NextResponse.json(
      { error: "recipientId is required" },
      { status: 400 }
    );
  }

  const result = await createMessageRequest(senderId, recipientId, introMessage);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.data);
}

// ---------------------------------------------------------------------------
// GET — List requests or check status between two users
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { searchParams } = req.nextUrl;
  const recipientId = searchParams.get("recipientId");
  const view = searchParams.get("view") as "pending" | "sent" | "all" | null;

  // If recipientId is provided, return status between two users
  if (recipientId) {
    const status = await getRequestStatus(userId, recipientId);
    return NextResponse.json(status);
  }

  // Otherwise return list of requests
  const requests = await getMessageRequests(userId, view ?? "pending");
  return NextResponse.json({ requests });
}

// ---------------------------------------------------------------------------
// PATCH — Accept or reject a request
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const body = await req.json();
  const { requestId, action } = body;

  if (!requestId || !action) {
    return NextResponse.json(
      { error: "requestId and action are required" },
      { status: 400 }
    );
  }

  if (action !== "accept" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'accept' or 'reject'" },
      { status: 400 }
    );
  }

  try {
    const result = action === "accept"
      ? await acceptMessageRequest(requestId, userId)
      : await rejectMessageRequest(requestId, userId);

    if (!result.success) {
      console.error(`[chat/requests] ${action} failed:`, result.error);
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data ?? { ok: true });
  } catch (e) {
    console.error(`[chat/requests] ${action} threw:`, e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
