import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const workspace =
    (await resolveActiveWorkspace(auth.supabase, auth.user.id)) ??
    (await ensurePersonalWorkspace(auth.user));

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

async function ensurePersonalWorkspace(
  user: User
): Promise<WorkspaceContext | null> {
  try {
    const admin = createAdminClient();

    const { data: membership } = await admin
      .from("workspace_members")
      .select(
        "workspace_id, role, workspaces(id, name, owner_id, plan, subscription_status, subscription_renews_at, subscription_started_at)"
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    const existing = toWorkspaceContext(membership);
    if (existing) return existing;

    const { data: ownedWorkspace } = await admin
      .from("workspaces")
      .select(
        "id, name, owner_id, plan, subscription_status, subscription_renews_at, subscription_started_at"
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const workspace =
      ownedWorkspace ??
      (await admin
        .from("workspaces")
        .insert({
          name: `${displayNameFor(user)}'s Workspace`,
          owner_id: user.id,
        })
        .select(
          "id, name, owner_id, plan, subscription_status, subscription_renews_at, subscription_started_at"
        )
        .single()
        .then(({ data }) => data));

    if (!workspace) return null;

    await admin.from("workspace_members").upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      },
      { onConflict: "workspace_id,user_id" }
    );

    await admin.from("settings").upsert(
      {
        user_id: user.id,
        default_workspace_id: workspace.id,
      },
      { onConflict: "user_id" }
    );

    return {
      id: workspace.id,
      name: workspace.name,
      owner_id: workspace.owner_id,
      plan: workspace.plan,
      subscription_status: workspace.subscription_status,
      subscription_renews_at: workspace.subscription_renews_at,
      subscription_started_at: workspace.subscription_started_at,
      role: "owner",
    } as WorkspaceContext;
  } catch (error) {
    console.error("[workspace] auto-provision failed", error);
    return null;
  }
}

function toWorkspaceContext(row: unknown): WorkspaceContext | null {
  type MembershipRow = {
    role: WorkspaceRole;
    workspaces:
      | {
          id: string;
          name: string;
          owner_id: string;
          plan: WorkspaceContext["plan"];
          subscription_status: WorkspaceContext["subscription_status"];
          subscription_renews_at: string | null;
          subscription_started_at: string | null;
        }
      | null;
  };

  const typed = row as MembershipRow | null;
  if (!typed?.workspaces) return null;

  return {
    id: typed.workspaces.id,
    name: typed.workspaces.name,
    owner_id: typed.workspaces.owner_id,
    plan: typed.workspaces.plan,
    subscription_status: typed.workspaces.subscription_status,
    subscription_renews_at: typed.workspaces.subscription_renews_at,
    subscription_started_at: typed.workspaces.subscription_started_at,
    role: typed.role,
  };
}

function displayNameFor(user: User) {
  const metaName = user.user_metadata?.full_name;
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  if (user.email) return user.email.split("@")[0] ?? "Workspace";
  return "Workspace";
}
