import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { processMeetingArtifacts } from "@/lib/meeting-processing";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { meetingId, transcript, fallbackTitle } = await request.json();
  if (!meetingId || !transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "meetingId and transcript are required" }, { status: 400 });
  }

  try {
    const artifacts = await processMeetingArtifacts({
      supabase,
      userId: user.id,
      meetingId,
      transcript,
      fallbackTitle: fallbackTitle ?? null,
    });

    return NextResponse.json(artifacts);
  } catch (error) {
    await supabase.from("meetings").update({ processing_status: "error", processing_error: error instanceof Error ? error.message : "Processing failed" }).eq("id", meetingId).eq("user_id", user.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Processing failed" }, { status: 500 });
  }
}
