import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

const BUCKET = "meeting-audio";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const formData = await request.formData();
  const file = formData.get("audio");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  // Path starts with the user id so storage RLS can gate access by owner.
  const filename = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webm`;
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, arrayBuffer, { contentType: "audio/webm", upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Store the storage path instead of a public URL so the bucket can stay private.
  return NextResponse.json({ path: filename });
}
