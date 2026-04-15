import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { enforceQuota } from "@/lib/billing/enforce";

export async function POST(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { user, supabase, workspace } = auth;

  const body = await request.json();

  if (!body.recording_mode) {
    return NextResponse.json({ error: "recording_mode required" }, { status: 400 });
  }

  const blocked = await enforceQuota(supabase, workspace);
  if (blocked) return blocked;

  const { data, error } = await supabase
    .from("recording_sessions")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      user_email: user.email ?? null,
      recording_mode: body.recording_mode,
      status: body.status ?? "starting",
      system_audio_requested: body.system_audio_requested ?? false,
      system_audio_active: body.system_audio_active ?? false,
      started_at: body.started_at ?? new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
