import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMeetingArtifacts } from "@/lib/openrouter/summarize";

type SonioxToken = {
  text?: string;
  start_ms?: number;
  end_ms?: number;
  speaker?: string | number;
};

export function buildTranscriptSegmentsFromTokens(tokens: SonioxToken[]) {
  const segments: Array<{
    speaker_id: number;
    text: string;
    start_ms: number;
    end_ms: number;
  }> = [];

  let current: (typeof segments)[number] | null = null;

  for (const token of tokens) {
    const text = (token.text ?? "").replace(/<end>/gi, "");
    if (!text) continue;

    const speakerId = Number.parseInt(String(token.speaker ?? "1"), 10) || 1;

    if (!current || current.speaker_id !== speakerId) {
      if (current) segments.push(current);
      current = {
        speaker_id: speakerId,
        text,
        start_ms: token.start_ms ?? 0,
        end_ms: token.end_ms ?? 0,
      };
      continue;
    }

    current.text += text;
    current.end_ms = token.end_ms ?? current.end_ms;
  }

  if (current) segments.push(current);
  return segments;
}

export async function processMeetingArtifacts({
  supabase,
  userId,
  meetingId,
  transcript,
  fallbackTitle,
}: {
  supabase: SupabaseClient;
  userId: string;
  meetingId: string;
  transcript: string;
  fallbackTitle?: string | null;
}) {
  const { data: settings } = await supabase
    .from("settings")
    .select("system_prompt")
    .eq("user_id", userId)
    .maybeSingle();

  const artifacts = await generateMeetingArtifacts(
    transcript,
    settings?.system_prompt?.trim() || undefined
  );

  const resolvedTitle = artifacts.title?.trim() || fallbackTitle?.trim() || "Meeting";

  const { error: meetingError } = await supabase
    .from("meetings")
    .update({
      title: resolvedTitle,
      summary: artifacts.summary,
      key_points: artifacts.keyPoints,
      processing_status: "completed",
      processing_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meetingId)
    .eq("user_id", userId);

  if (meetingError) throw new Error(meetingError.message);

  await supabase.from("meeting_decisions").delete().eq("meeting_id", meetingId).eq("user_id", userId);
  await supabase.from("meeting_tasks").delete().eq("meeting_id", meetingId).eq("user_id", userId);

  if (artifacts.decisions.length > 0) {
    const { error } = await supabase.from("meeting_decisions").insert(
      artifacts.decisions.map((content) => ({ meeting_id: meetingId, user_id: userId, content }))
    );

    if (error) throw new Error(error.message);
  }

  if (artifacts.tasks.length > 0) {
    const { error } = await supabase.from("meeting_tasks").insert(
      artifacts.tasks.map((task) => ({
        meeting_id: meetingId,
        user_id: userId,
        description: task.description,
        owner_name: task.owner || null,
        due_date: task.dueDate || null,
        status: "in_progress",
      }))
    );

    if (error) throw new Error(error.message);
  }

  return artifacts;
}
