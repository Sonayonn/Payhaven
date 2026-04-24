import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { env } from "@/lib/env";

let cached: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Server-only Supabase client. Uses the service role key, bypasses RLS.
 * Never import from a client component.
 */
export function getSupabase() {
  if (cached) return cached;
  cached = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cached;
}