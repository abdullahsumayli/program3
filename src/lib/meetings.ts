import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlan, type PlanId } from "@/lib/billing/plans";

export async function getUsageSummary(
  supabase: SupabaseClient,
  workspaceId: string,
  plan: PlanId | string | null | undefined,
  monthlyMeetingLimitOverride?: number | null,
  monthlyExtraMinutes = 0
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
  const hasMeetingOverride =
    typeof monthlyMeetingLimitOverride === "number" &&
    Number.isFinite(monthlyMeetingLimitOverride);
  const meetingsUnlimited =
    planConfig.unlimited || monthlyMeetingLimitOverride === -1;
  const meetingLimit =
    hasMeetingOverride && monthlyMeetingLimitOverride !== -1
      ? monthlyMeetingLimitOverride
      : planConfig.monthlyMeetings;
  const minutesUnlimited = planConfig.unlimited;
  const cleanExtraMinutes =
    Number.isInteger(monthlyExtraMinutes) && monthlyExtraMinutes > 0
      ? monthlyExtraMinutes
      : 0;
  const baseLimitSeconds = planConfig.monthlyMinutes * 60;
  const extraLimitSeconds = cleanExtraMinutes * 60;
  const limitSeconds = baseLimitSeconds + extraLimitSeconds;
  const usedSeconds = (data ?? []).reduce(
    (sum, meeting) => sum + (meeting.duration ?? 0),
    0
  );
  const extraUsedSeconds = Math.min(
    extraLimitSeconds,
    Math.max(0, usedSeconds - baseLimitSeconds)
  );
  const extraRemainingSeconds = Math.max(0, extraLimitSeconds - extraUsedSeconds);
  const remainingSeconds = Math.max(0, limitSeconds - usedSeconds);
  const meetingCount = (data ?? []).length;

  return {
    plan: planConfig.id,
    baseLimitMinutes: minutesUnlimited ? -1 : planConfig.monthlyMinutes,
    limitMinutes: minutesUnlimited ? -1 : planConfig.monthlyMinutes + cleanExtraMinutes,
    usedMinutes: Math.ceil(usedSeconds / 60),
    remainingMinutes: minutesUnlimited
      ? -1
      : Math.ceil(remainingSeconds / 60),
    remainingSeconds: minutesUnlimited ? 999999 : remainingSeconds,
    monthlyExtraMinutes: cleanExtraMinutes,
    monthlyExtraMinutesUsed: Math.ceil(extraUsedSeconds / 60),
    monthlyExtraMinutesRemaining: Math.ceil(extraRemainingSeconds / 60),
    limitMeetings: meetingsUnlimited ? -1 : meetingLimit,
    usedMeetings: meetingCount,
    remainingMeetings: meetingsUnlimited
      ? 999999
      : Math.max(0, meetingLimit - meetingCount),
    unlimited: planConfig.unlimited,
    minutesUnlimited,
    meetingsUnlimited,
    monthlyMeetingLimitOverride: hasMeetingOverride
      ? monthlyMeetingLimitOverride
      : null,
  };
}
