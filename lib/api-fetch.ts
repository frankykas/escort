/**
 * Client-side fetch wrapper that auto-attaches the user's Supabase JWT
 * as a Bearer token. Use this for **every** call to `/api/*` from client
 * components — never call `fetch` directly.
 *
 * The matching server-side helper is `requireUser` in `lib/api-auth.ts`.
 *
 * Usage:
 *
 *   import { apiFetch } from "@/lib/api-fetch";
 *
 *   const res = await apiFetch("/api/listings/bump", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ listingId, tier }),
 *   });
 *
 * If the user is not signed in, the request still goes out (without a
 * token) so public endpoints continue to work; private endpoints will
 * respond 401 and the caller should handle it.
 */

import { supabase } from "@/lib/supabase/client";

export async function apiFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);

  // Pull the access token from the active session
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, { ...init, headers });
}
