import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get("track_id");

  let query = supabase
    .from("meetings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (trackId) query = query.eq("track_id", trackId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json();

  if (!body.track_id) {
    return NextResponse.json({ error: "track_id required" }, { status: 400 });
  }

  // Verify the track belongs to this user before creating a meeting in it
  const { data: track } = await supabase
    .from("tracks")
    .select("id")
    .eq("id", body.track_id)
    .eq("user_id", user.id)
    .single();
  if (!track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      track_id: body.track_id,
      user_id: user.id,
      title: body.title ?? null,
      transcript: body.transcript ?? "",
      transcript_segments: body.transcript_segments ?? null,
      summary: body.summary ?? null,
      duration: body.duration ?? 0,
      audio_url: body.audio_url ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
