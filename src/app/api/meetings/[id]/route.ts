import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";

export async function GET(_req: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { id } = await ctx.params;
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/meetings/[id]">) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const { id } = await ctx.params;
  const body = await request.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.transcript !== undefined) updates.transcript = body.transcript;
  if (body.transcript_segments !== undefined) updates.transcript_segments = body.transcript_segments;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.key_points !== undefined) updates.key_points = body.key_points;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.duration !== undefined) updates.duration = body.duration;
  if (body.audio_url !== undefined) updates.audio_url = body.audio_url;
  if (body.processing_status !== undefined) updates.processing_status = body.processing_status;
  if (body.processing_error !== undefined) updates.processing_error = body.processing_error;

  const { data, error } = await supabase
    .from("meetings")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
