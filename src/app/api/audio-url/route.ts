import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";

const BUCKET = "meeting-audio";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// Mints a short-lived signed URL for a stored audio file.
// The storage RLS policy enforces that users can only read their own files,
// so this endpoint just validates that the requester is logged in.
export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path) return NextResponse.json({ error: "path required" }, { status: 400 });

  // Enforce ownership by path convention
  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
