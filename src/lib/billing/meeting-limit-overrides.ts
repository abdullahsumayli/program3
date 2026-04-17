import type { SupabaseClient } from "@supabase/supabase-js";

const EVENT_TYPE = "meeting_limit_override";

type OverridePayload = {
  monthly_meeting_limit_override?: unknown;
};

export function normalizeMeetingLimitOverride(limit: unknown): number | null {
  if (limit === null || limit === undefined) return null;
  if (typeof limit !== "number" || !Number.isInteger(limit)) return null;
  if (limit === -1 || limit > 0) return limit;
  return null;
}

export async function getMeetingLimitOverride(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<number | null> {
  const { data, error } = await supabase
    .from("subscription_events")
    .select("moyasar_payload")
    .eq("workspace_id", workspaceId)
    .eq("event_type", EVENT_TYPE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const payload = data.moyasar_payload as OverridePayload | null;
  return normalizeMeetingLimitOverride(payload?.monthly_meeting_limit_override);
}

export async function setMeetingLimitOverride(
  supabase: SupabaseClient,
  workspaceId: string,
  limit: number | null
) {
  return supabase.from("subscription_events").insert({
    workspace_id: workspaceId,
    event_type: EVENT_TYPE,
    moyasar_payload: {
      monthly_meeting_limit_override: limit,
    },
  });
}
