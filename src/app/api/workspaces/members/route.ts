import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(request: Request) {
  const auth = await requireWorkspace("admin");
  if (auth.error) return auth.error;
  const { supabase, workspace, user } = auth;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === workspace.owner_id) {
    return NextResponse.json({ error: "Cannot remove the workspace owner" }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "Use leave endpoint to remove yourself" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireWorkspace("owner");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { userId, role } = await request.json();
  if (!userId || !["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "userId and role (admin|member) required" }, { status: 400 });
  }
  if (userId === workspace.owner_id) {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
