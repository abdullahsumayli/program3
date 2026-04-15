import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";

// Cancels the workspace subscription at the end of the current period.
// Downgrade to free and flag status canceled; access continues until renewal.
export async function POST() {
  const auth = await requireWorkspace("owner");
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  if (workspace.plan !== "paid") {
    return NextResponse.json({ error: "Not on paid plan" }, { status: 400 });
  }

  const { error } = await supabase
    .from("workspaces")
    .update({ subscription_status: "canceled" })
    .eq("id", workspace.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
