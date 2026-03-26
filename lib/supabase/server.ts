import { createClient } from "@supabase/supabase-js";

// Server-side client — safe to call in Server Components and Route Handlers.
// Uses the anon key; relies on RLS policies for data access control.
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}
