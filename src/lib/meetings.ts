import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, type PlanId } from "@/lib/billing/plans";

export async function getUsageSummary(
  supabase: SupabaseClient,
  workspaceId: string,
  plan: PlanId | string | null | undefined
) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { data, error } = await supabase
    .from("meetings")
    .select("duration")
    .eq("workspace_id", workspaceId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) throw new Error(error.message);

  const planConfig = getPlan(plan);
  const limitSeconds = planConfig.monthlyMinutes * 60;
  const usedSeconds = (data ?? []).reduce(
    (sum, meeting) => sum + (meeting.duration ?? 0),
    0
  );
  const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);

  return {
    plan: planConfig.id,
    limitMinutes: planConfig.monthlyMinutes,
    usedMinutes: Math.ceil(usedSeconds / 60),
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    remainingSeconds,
  };
}
