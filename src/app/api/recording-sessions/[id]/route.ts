import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/recording-sessions/[id]">
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { user, supabase } = auth;
  const { id } = await ctx.params;
  const body = await request.json();

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status !== undefined) updates.status = body.status;
  if (body.interruption_count !== undefined) updates.interruption_count = body.interruption_count;
  if (body.duration_seconds !== undefined) updates.duration_seconds = body.duration_seconds;
  if (body.system_audio_active !== undefined) updates.system_audio_active = body.system_audio_active;
  if (body.last_error_status !== undefined) updates.last_error_status = body.last_error_status;
  if (body.last_error_message !== undefined) updates.last_error_message = body.last_error_message;
  if (body.meeting_id !== undefined) updates.meeting_id = body.meeting_id;
  if (body.ended_at !== undefined) updates.ended_at = body.ended_at;
  if (body.last_heartbeat_at !== undefined) {
    updates.last_heartbeat_at = body.last_heartbeat_at;
  } else {
    updates.last_heartbeat_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("recording_sessions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
