import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";

export async function GET() {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { user, supabase, workspace } = auth;

  const body = await request.json();

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspace.id,
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
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspace.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
