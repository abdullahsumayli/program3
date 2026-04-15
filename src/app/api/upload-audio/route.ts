import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";

const BUCKET = "meeting-audio";

export async function POST(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { supabase, workspace } = auth;

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  // Path starts with the workspace id so storage RLS gates by membership.
  const filename = `${workspace.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webm`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, arrayBuffer, { contentType: "audio/webm", upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ path: filename });
}
