import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { processMeetingArtifacts } from "@/lib/meeting-processing";

export async function POST(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { user, supabase, workspace } = auth;

  const { meetingId, transcript, fallbackTitle } = await request.json();
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId is required" }, { status: 400 });
  }

  const cleanTranscript = transcript && typeof transcript === "string" ? transcript.trim() : "";
  if (!cleanTranscript) {
    await supabase
      .from("meetings")
      .update({ processing_status: "completed" })
      .eq("id", meetingId)
      .eq("workspace_id", workspace.id);
    return NextResponse.json({ summary: null, tasks: [], decisions: [] });
  }

  try {
    const artifacts = await processMeetingArtifacts({
      supabase,
      userId: user.id,
      workspaceId: workspace.id,
      meetingId,
      transcript: cleanTranscript,
      fallbackTitle: fallbackTitle ?? null,
    });

    return NextResponse.json(artifacts);
  } catch (error) {
    await supabase
      .from("meetings")
      .update({
        processing_status: "error",
        processing_error: error instanceof Error ? error.message : "Processing failed",
      })
      .eq("id", meetingId)
      .eq("workspace_id", workspace.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Processing failed" },
      { status: 500 }
    );
  }
}
