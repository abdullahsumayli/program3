import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  void request;
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const body = await request.json();

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      user_id: user.id,
      title: body.title ?? null,
      transcript: body.transcript ?? "",
      transcript_segments: body.transcript_segments ?? null,
      summary: body.summary ?? null,
      key_points: body.key_points ?? null,
      duration: body.duration ?? 0,
      audio_url: body.audio_url ?? null,
      source_type: body.source_type ?? "live_recording",
      processing_status: body.processing_status ?? "completed",
      processing_error: body.processing_error ?? null,
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

  const { error } = await supabase.from("meetings").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
