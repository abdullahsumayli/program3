import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { user, supabase } = auth;
  const body = await request.json();

  if (!body.recording_mode) {
    return NextResponse.json({ error: "recording_mode required" }, { status: 400 });
  }

  if (body.track_id) {
    const { data: track } = await supabase
      .from("tracks")
      .select("id")
      .eq("id", body.track_id)
      .eq("user_id", user.id)
      .single();

    if (!track) {
      return NextResponse.json({ error: "Track not found" }, { status: 404 });
    }
  }

  const { data, error } = await supabase
    .from("recording_sessions")
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      track_id: body.track_id ?? null,
      recording_mode: body.recording_mode,
      status: body.status ?? "starting",
      system_audio_requested: body.system_audio_requested ?? false,
      system_audio_active: body.system_audio_active ?? false,
      started_at: body.started_at ?? new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
