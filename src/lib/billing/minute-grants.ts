import type { SupabaseClient } from "@supabase/supabase-js";

const EVENT_TYPE = "free_minute_grant";

type MinuteGrantPayload = {
  minutes?: unknown;
  period_start?: unknown;
};

export function getCurrentUsagePeriodStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

export function normalizeMinuteGrant(minutes: unknown): number {
  if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes <= 0) {
    return 0;
  }
  return minutes;
}

export async function getMonthlyFreeMinuteGrant(
  supabase: SupabaseClient,
  workspaceId: string,
  periodStart = getCurrentUsagePeriodStart()
): Promise<number> {
  const { data, error } = await supabase
    .from("subscription_events")
    .select("moyasar_payload")
    .eq("workspace_id", workspaceId)
    .eq("event_type", EVENT_TYPE);

  if (error || !data) return 0;

  return data.reduce((sum, row) => {
    const payload = row.moyasar_payload as MinuteGrantPayload | null;
    if (payload?.period_start !== periodStart) return sum;
    return sum + normalizeMinuteGrant(payload.minutes);
  }, 0);
}

export async function addMonthlyFreeMinuteGrant(
  supabase: SupabaseClient,
  workspaceId: string,
  minutes: number,
  periodStart = getCurrentUsagePeriodStart()
) {
  return supabase.from("subscription_events").insert({
    workspace_id: workspaceId,
    event_type: EVENT_TYPE,
    moyasar_payload: {
      minutes,
      period_start: periodStart,
    },
  });
}
