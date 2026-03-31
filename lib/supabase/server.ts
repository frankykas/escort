import { createClient } from "@supabase/supabase-js";

// Server-side client for Route Handlers and server-only lib functions.
// Uses the service role key to bypass RLS — these operations are trusted
// because the API routes validate the caller before invoking lib functions.
// Falls back to anon key if service role key is not set.
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const key = serviceRoleKey || anonKey;
  if (!supabaseUrl || !key) {
    return null;
  }

  return createClient(supabaseUrl, key);
}
