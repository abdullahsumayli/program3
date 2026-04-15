import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-only, non-user-scoped operations
 * (webhooks, cron jobs). Bypasses RLS — NEVER import this from a user-scoped
 * API route.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase service role credentials missing");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
