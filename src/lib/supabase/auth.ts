import { NextResponse } from "next/server";
import { createClient } from "./server";
import type { User } from "@supabase/supabase-js";

/**
 * Require an authenticated user for API route handlers.
 * Returns either { user, supabase } or a NextResponse with 401 to return directly.
 */
export async function requireUser(): Promise<
  | { user: User; supabase: Awaited<ReturnType<typeof createClient>>; error?: never }
  | { error: NextResponse; user?: never; supabase?: never }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, supabase };
}
