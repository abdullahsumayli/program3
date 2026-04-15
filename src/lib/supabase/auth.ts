import { NextResponse } from "next/server";
import { createClient } from "./server";
import type { User, SupabaseClient } from "@supabase/supabase-js";
import {
  resolveActiveWorkspace,
  roleSatisfies,
  type WorkspaceContext,
  type WorkspaceRole,
} from "@/lib/workspace/context";

type AuthOk = {
  user: User;
  supabase: SupabaseClient;
  error?: never;
};

type AuthErr = {
  error: NextResponse;
  user?: never;
  supabase?: never;
};

/**
 * Require an authenticated user for API route handlers.
 */
export async function requireUser(): Promise<AuthOk | AuthErr> {
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

type WorkspaceOk = AuthOk & { workspace: WorkspaceContext };
type WorkspaceErr = AuthErr;

/**
 * Require an authenticated user AND an active workspace they belong to.
 * Optionally enforce a minimum role.
 */
export async function requireWorkspace(
  minRole: WorkspaceRole = "member"
): Promise<WorkspaceOk | WorkspaceErr> {
  const auth = await requireUser();
  if (auth.error) return auth;

  const workspace = await resolveActiveWorkspace(auth.supabase, auth.user.id);

  if (!workspace) {
    return {
      error: NextResponse.json(
        { error: "No workspace. Create or join one." },
        { status: 403 }
      ),
    };
  }

  if (!roleSatisfies(workspace.role, minRole)) {
    return {
      error: NextResponse.json(
        { error: `Requires ${minRole} role.` },
        { status: 403 }
      ),
    };
  }

  return { user: auth.user, supabase: auth.supabase, workspace };
}
