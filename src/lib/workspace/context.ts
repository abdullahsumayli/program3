import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

export type WorkspaceRole = "owner" | "admin" | "member";

export type WorkspaceContext = {
  id: string;
  name: string;
  owner_id: string;
  plan: "free" | "basic" | "pro" | "enterprise";
  subscription_status: "active" | "trial" | "expired" | "canceled" | "past_due";
  subscription_renews_at: string | null;
  subscription_started_at: string | null;
  role: WorkspaceRole;
};

/**
 * Resolve the workspace the current user is acting in.
 *
 * Resolution order:
 *   1. `active_workspace_id` cookie (if user is a member of it)
 *   2. `settings.default_workspace_id`
 *   3. First workspace the user belongs to (by created_at)
 */
export async function resolveActiveWorkspace(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceContext | null> {
  const cookieStore = await cookies();
  const cookieWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, owner_id, plan, subscription_status, subscription_renews_at, subscription_started_at)")
    .eq("user_id", userId);

  if (!memberships || memberships.length === 0) return null;

  const byId = new Map<
    string,
    { role: WorkspaceRole; ws: WorkspaceContext }
  >();

  for (const row of memberships) {
    type MembershipRow = {
      workspace_id: string;
      role: WorkspaceRole;
      workspaces:
        | {
            id: string;
            name: string;
            owner_id: string;
            plan: "free" | "basic" | "pro" | "enterprise";
            subscription_status: "active" | "trial" | "expired" | "canceled" | "past_due";
            subscription_renews_at: string | null;
            subscription_started_at: string | null;
          }
        | null;
    };
    const typed = row as unknown as MembershipRow;
    if (!typed.workspaces) continue;
    byId.set(typed.workspace_id, {
      role: typed.role,
      ws: {
        id: typed.workspaces.id,
        name: typed.workspaces.name,
        owner_id: typed.workspaces.owner_id,
        plan: typed.workspaces.plan,
        subscription_status: typed.workspaces.subscription_status,
        subscription_renews_at: typed.workspaces.subscription_renews_at,
        subscription_started_at: typed.workspaces.subscription_started_at,
        role: typed.role,
      },
    });
  }

  if (cookieWorkspaceId && byId.has(cookieWorkspaceId)) {
    return byId.get(cookieWorkspaceId)!.ws;
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("default_workspace_id")
    .eq("user_id", userId)
    .maybeSingle();

  const defaultId = settings?.default_workspace_id as string | null | undefined;
  if (defaultId && byId.has(defaultId)) {
    return byId.get(defaultId)!.ws;
  }

  const first = [...byId.values()][0];
  return first?.ws ?? null;
}

export function roleSatisfies(
  actual: WorkspaceRole,
  required: WorkspaceRole
): boolean {
  const rank: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 };
  return rank[actual] >= rank[required];
}
