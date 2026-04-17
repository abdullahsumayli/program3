import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { getUsageSummary } from "@/lib/meetings";
import { PLANS } from "@/lib/billing/plans";
import { getMeetingLimitOverride } from "@/lib/billing/meeting-limit-overrides";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const meetingLimitOverride = await getMeetingLimitOverride(
    createAdminClient(),
    workspace.id
  );
  const usage = await getUsageSummary(
    supabase,
    workspace.id,
    workspace.plan,
    meetingLimitOverride
  );
  const plan = PLANS[workspace.plan] ?? PLANS.free;

  const [
    { data: meetings, error: meetingsError },
    { data: decisions, error: decisionsError },
    { data: tasks, error: tasksError },
  ] = await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("meeting_decisions")
      .select("*, meetings(title, created_at)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("meeting_tasks")
      .select("*, meetings(title, created_at)")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false }),
  ]);

  if (meetingsError || decisionsError || tasksError) {
    return NextResponse.json(
      {
        error:
          meetingsError?.message ??
          decisionsError?.message ??
          tasksError?.message ??
          "Failed to load dashboard",
      },
      { status: 500 }
    );
  }

  const followUpOwners = new Map<string, string | null>();
  for (const task of tasks ?? []) {
    if (!followUpOwners.get(task.meeting_id) && task.owner_name) {
      followUpOwners.set(task.meeting_id, task.owner_name);
    }
  }

  return NextResponse.json({
    usage,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      role: workspace.role,
      plan: workspace.plan,
      planName: plan.name,
      subscription_status: workspace.subscription_status,
      subscription_renews_at: workspace.subscription_renews_at,
    },
    meetings: meetings ?? [],
    decisions: (decisions ?? []).map((decision) => ({
      ...decision,
      meeting_title: decision.meetings?.title ?? null,
      meeting_created_at: decision.meetings?.created_at ?? null,
      follow_up_owner: followUpOwners.get(decision.meeting_id) ?? null,
    })),
    tasks: (tasks ?? []).map((task) => ({
      ...task,
      meeting_title: task.meetings?.title ?? null,
      meeting_created_at: task.meetings?.created_at ?? null,
    })),
  });
}
