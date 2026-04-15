import type { SupabaseClient } from "@supabase/supabase-js";

export const MONTHLY_MINUTES_LIMIT = 120;
export const MONTHLY_SECONDS_LIMIT = MONTHLY_MINUTES_LIMIT * 60;

export async function getUsageSummary(supabase: SupabaseClient, userId: string) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const { data, error } = await supabase
    .from("meetings")
    .select("duration")
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .lt("created_at", end.toISOString());

  if (error) throw new Error(error.message);

  const usedSeconds = (data ?? []).reduce((sum, meeting) => sum + (meeting.duration ?? 0), 0);
  const remainingSeconds = Math.max(0, MONTHLY_SECONDS_LIMIT - usedSeconds);

  return {
    limitMinutes: MONTHLY_MINUTES_LIMIT,
    usedMinutes: Math.ceil(usedSeconds / 60),
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    remainingSeconds,
  };
}
