import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { isPaidPlan } from "@/lib/billing/plans";

export async function POST() {
  const auth = await requireWorkspace("owner");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  if (!isPaidPlan(workspace.plan)) {
    return NextResponse.json({ error: "Not on a paid plan" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ subscription_status: "canceled" })
    .eq("id", workspace.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
