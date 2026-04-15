import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { getUsageSummary } from "@/lib/meetings";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  if (!body.recording_mode) {
    return NextResponse.json({ error: "recording_mode required" }, { status: 400 });
  }

  const usage = await getUsageSummary(supabase, user.id);
  if (usage.remainingSeconds <= 0) {
    return NextResponse.json({ error: "Monthly recording balance exhausted" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("recording_sessions")
    .insert({
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
