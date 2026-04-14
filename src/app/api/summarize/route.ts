import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { generateTitle, summarizeTranscript } from "@/lib/openrouter/summarize";

const DEFAULT_MEETING_PROMPT =
  "Summarize this meeting transcript clearly and concisely.";

const DEFAULT_LECTURE_PROMPT =
  "You are summarizing an academic lecture transcript. Produce a structured study-oriented summary in the same language as the transcript (Arabic or English), including: (1) Main topic and learning objectives, (2) Key concepts and definitions, (3) Important examples or case studies mentioned, (4) Formulas, rules, or principles, (5) Any assignments, deadlines, or references the instructor mentioned, (6) A short list of review questions a student could use to test their understanding. Be thorough but organized with clear headings.";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const { user, supabase } = auth;

  const { meetingId, transcript, trackType } = await request.json();

  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "transcript required" }, { status: 400 });
  }

  let resolvedType: "meetings" | "lectures" =
    trackType === "lectures" ? "lectures" : "meetings";

  // If meetingId provided, verify ownership and (if no trackType) infer it
  if (meetingId) {
    const { data: meetingRow } = await supabase
      .from("meetings")
      .select("track_id, user_id")
      .eq("id", meetingId)
      .eq("user_id", user.id)
      .single();
    if (!meetingRow) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (!trackType && meetingRow.track_id) {
      const { data: trackRow } = await supabase
        .from("tracks")
        .select("type")
        .eq("id", meetingRow.track_id)
        .single();
      if (trackRow?.type === "lectures") resolvedType = "lectures";
    }
  }

  const { data: settings } = await supabase
    .from("settings")
    .select("system_prompt")
    .eq("user_id", user.id)
    .single();

  const defaultPrompt =
    resolvedType === "lectures" ? DEFAULT_LECTURE_PROMPT : DEFAULT_MEETING_PROMPT;
  const systemPrompt = settings?.system_prompt?.trim()
    ? settings.system_prompt
    : defaultPrompt;

  try {
    const summary = await summarizeTranscript(transcript, systemPrompt);
    const title = await generateTitle(summary);

    if (meetingId) {
      await supabase
        .from("meetings")
        .update({ summary, title, updated_at: new Date().toISOString() })
        .eq("id", meetingId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ summary, title });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Summarization failed" },
      { status: 500 }
    );
  }
}
