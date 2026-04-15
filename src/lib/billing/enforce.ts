import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsageSummary } from "@/lib/meetings";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * Returns a 403 NextResponse if the workspace has exhausted its quota,
 * or null to indicate it can proceed.
 */
export async function enforceQuota(
  supabase: SupabaseClient,
  workspace: WorkspaceContext
): Promise<NextResponse | null> {
  const now = Date.now();
  const renewsAtMs = workspace.subscription_renews_at ? Date.parse(workspace.subscription_renews_at) : null;
  const withinPaidPeriod =
    workspace.plan === "paid" &&
    renewsAtMs !== null &&
    Number.isFinite(renewsAtMs) &&
    renewsAtMs > now;

  // Free workspaces should not be blocked by subscription status.
  // Paid workspaces keep access until `subscription_renews_at` even if canceled.
  if (
    workspace.plan === "paid" &&
    workspace.subscription_status !== "active" &&
    !withinPaidPeriod
  ) {
    return NextResponse.json(
      {
        error: "subscription_inactive",
        message: "Workspace subscription is not active.",
      },
      { status: 402 }
    );
  }

  const usage = await getUsageSummary(supabase, workspace.id, workspace.plan);
  if (usage.remainingSeconds <= 0) {
    return NextResponse.json(
      {
        error: "quota_exhausted",
        plan: usage.plan,
        limitMinutes: usage.limitMinutes,
        message: "Monthly recording balance exhausted.",
      },
      { status: 402 }
    );
  }

  return null;
}
