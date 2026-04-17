import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, owner_id, plan, subscription_status, subscription_renews_at, subscription_started_at, created_at)")
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { role: string; workspaces: { id: string; name: string; owner_id: string; plan: string; subscription_status: string; subscription_renews_at: string | null; created_at: string } | null };
  const typed = (data ?? []) as unknown as Row[];
  const workspaces = typed
    .filter((row) => row.workspaces)
    .map((row) => ({ ...row.workspaces!, role: row.role }));

  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { name } = await request.json();
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name: trimmed, owner_id: user.id })
    .select()
    .single();

  if (error || !workspace) {
    return NextResponse.json({ error: error?.message ?? "Failed to create workspace" }, { status: 500 });
  }

  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: workspace.id, user_id: user.id, role: "owner" });

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  return NextResponse.json(workspace);
}
