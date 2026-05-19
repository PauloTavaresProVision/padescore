import { createClient } from "@supabase/supabase-js";

/**
 * Admin client (service role). Bypasses RLS — use ONLY in server-side code
 * (route handlers, server actions) for operator endpoints that need to read/write
 * matches without an authenticated user (e.g. /score/[token]).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
