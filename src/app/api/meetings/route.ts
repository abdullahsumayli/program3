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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowedSources = ["live_recording", "uploaded_recording"];
  const sourceType = allowedSources.includes(body.source_type as string)
    ? (body.source_type as string)
    : "live_recording";

  const { data, error } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      title: body.title ?? null,
      transcript: body.transcript ?? "",
      transcript_segments: body.transcript_segments ?? null,
      duration: typeof body.duration === "number" ? body.duration : 0,
      audio_url: typeof body.audio_url === "string" ? body.audio_url : null,
      source_type: sourceType,
      processing_status: "processing",
      processing_error: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to create meeting" }, { status: 500 });
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
