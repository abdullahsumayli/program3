import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action: string };
  const db = createAdminClient();

  switch (action) {
    case "change_plan": {
      const { plan } = body as { plan: string };
      if (!["free", "paid"].includes(plan)) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      const { error } = await db
        .from("workspaces")
        .update({ plan, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "change_status": {
      const { status } = body as { status: string };
      if (!["active", "past_due", "canceled"].includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      const { error } = await db
        .from("workspaces")
        .update({ subscription_status: status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "extend_subscription": {
      const { renews_at } = body as { renews_at: string };
      if (!renews_at) {
        return NextResponse.json({ error: "Missing renews_at" }, { status: 400 });
      }
      const { error } = await db
        .from("workspaces")
        .update({
          subscription_renews_at: renews_at,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "reset_usage": {
      const { error } = await db
        .from("usage_counters")
        .upsert({
          workspace_id: id,
          seconds_used: 0,
          period_start: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "add_minutes": {
      const { minutes } = body as { minutes: number };
      if (!minutes || minutes <= 0) {
        return NextResponse.json({ error: "Invalid minutes" }, { status: 400 });
      }
      const { data: existing } = await db
        .from("usage_counters")
        .select("seconds_used")
        .eq("workspace_id", id)
        .single();

      const currentUsed = existing?.seconds_used ?? 0;
      const newUsed = Math.max(0, currentUsed - minutes * 60);

      const { error } = await db
        .from("usage_counters")
        .upsert({
          workspace_id: id,
          seconds_used: newUsed,
          period_start: existing ? undefined : new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    case "remove_member": {
      const { user_id } = body as { user_id: string };
      if (!user_id) {
        return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
      }
      const { error } = await db
        .from("workspace_members")
        .delete()
        .eq("workspace_id", id)
        .eq("user_id", user_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db.from("workspaces").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
