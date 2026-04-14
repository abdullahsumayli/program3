import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { id } = await params;
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.transcript !== undefined) updates.transcript = body.transcript;
  if (body.transcript_segments !== undefined) updates.transcript_segments = body.transcript_segments;
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.notes !== undefined) updates.notes = body.notes;
  if (body.duration !== undefined) updates.duration = body.duration;
  if (body.audio_url !== undefined) updates.audio_url = body.audio_url;

  const { data, error } = await supabase
    .from("meetings")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
