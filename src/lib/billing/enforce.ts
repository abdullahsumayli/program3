import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsageSummary } from "@/lib/meetings";
import { getMeetingLimitOverride } from "@/lib/billing/meeting-limit-overrides";
import { getMonthlyFreeMinuteGrant } from "@/lib/billing/minute-grants";
import { isPaidPlan } from "@/lib/billing/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceContext } from "@/lib/workspace/context";

/**
 * Returns a 402 NextResponse if the workspace cannot start a new recording,
 * or null to indicate it can proceed.
 *
 * Checks:
 *   1. Subscription is active (or trial, or free plan)
 *   2. Monthly meeting count within limit
 *   3. Monthly minutes within limit
 */
export async function enforceQuota(
  supabase: SupabaseClient,
  workspace: WorkspaceContext
): Promise<NextResponse | null> {
  const now = Date.now();
  const renewsAtMs = workspace.subscription_renews_at
    ? Date.parse(workspace.subscription_renews_at)
    : null;
  const withinPaidPeriod =
    isPaidPlan(workspace.plan) &&
    renewsAtMs !== null &&
    Number.isFinite(renewsAtMs) &&
    renewsAtMs > now;

  if (workspace.subscription_status === "expired") {
    return NextResponse.json(
      {
        error: "subscription_expired",
        message: "Subscription has expired. Please renew to continue recording.",
      },
      { status: 402 }
    );
  }

  if (
    isPaidPlan(workspace.plan) &&
    workspace.subscription_status !== "active" &&
    workspace.subscription_status !== "trial" &&
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

  const admin = createAdminClient();
  const [meetingLimitOverride, freeMinuteGrant] = await Promise.all([
    getMeetingLimitOverride(admin, workspace.id),
    workspace.plan === "free"
      ? getMonthlyFreeMinuteGrant(admin, workspace.id)
      : Promise.resolve(0),
  ]);
  const usage = await getUsageSummary(
    supabase,
    workspace.id,
    workspace.plan,
    meetingLimitOverride,
    freeMinuteGrant
  );

  if (!usage.meetingsUnlimited && usage.remainingMeetings <= 0) {
    return NextResponse.json(
      {
        error: "meeting_limit_reached",
        plan: usage.plan,
        limitMeetings: usage.limitMeetings,
        message: "Monthly meeting limit reached.",
      },
      { status: 402 }
    );
  }

  if (!usage.minutesUnlimited && usage.remainingSeconds <= 0) {
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

/**
 * Lighter check: returns true if the subscription allows any activity at all
 * (viewing is always allowed, but recording/uploading may be blocked).
 */
export function isSubscriptionActive(workspace: WorkspaceContext): boolean {
  if (workspace.plan === "free") return true;
  if (
    workspace.subscription_status === "active" ||
    workspace.subscription_status === "trial"
  ) {
    return true;
  }
  if (workspace.subscription_renews_at) {
    return Date.parse(workspace.subscription_renews_at) > Date.now();
  }
  return false;
}
