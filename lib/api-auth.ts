/**
 * Server-side auth helpers for Route Handlers.
 *
 * Verifies the caller's identity by reading a Supabase JWT from the
 * `Authorization: Bearer <token>` header and asking Supabase to validate it.
 *
 * This is the only way mutating API routes should derive `userId` —
 * **never** trust an id passed in the request body or query string.
 *
 * Usage:
 *
 *   import { requireUser } from "@/lib/api-auth";
 *
 *   export async function POST(req: NextRequest) {
 *     const auth = await requireUser(req);
 *     if (!auth.ok) return auth.response;
 *     const userId = auth.user.id;
 *     // ... use userId, ignore anything the client sent
 *   }
 *
 * The matching client wrapper is `apiFetch` in `lib/api-fetch.ts`, which
 * automatically attaches the bearer token from the active session.
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type AuthOk = {
  ok: true;
  user: { id: string; email: string | null };
};

type AuthFail = {
  ok: false;
  response: NextResponse;
};

export async function requireUser(req: NextRequest): Promise<AuthOk | AuthFail> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Auth not configured" },
        { status: 500 }
      ),
    };
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      ),
    };
  }

  // A throwaway client just to validate the JWT — no session persistence.
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    user: { id: data.user.id, email: data.user.email ?? null },
  };
}
