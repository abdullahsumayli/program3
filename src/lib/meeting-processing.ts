import type { SupabaseClient } from "@supabase/supabase-js";
import { generateMeetingArtifacts } from "@/lib/openrouter/summarize";
import { sendEmail } from "@/lib/email/client";
import { taskAssignedEmail } from "@/lib/email/templates";

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
  workspaceId,
  meetingId,
  transcript,
  fallbackTitle,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
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
    .eq("workspace_id", workspaceId);

  if (meetingError) throw new Error(meetingError.message);

  await supabase
    .from("meeting_decisions")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("workspace_id", workspaceId);
  await supabase
    .from("meeting_tasks")
    .delete()
    .eq("meeting_id", meetingId)
    .eq("workspace_id", workspaceId);

  if (artifacts.decisions.length > 0) {
    const { error } = await supabase.from("meeting_decisions").insert(
      artifacts.decisions.map((content) => ({
        meeting_id: meetingId,
        workspace_id: workspaceId,
        user_id: userId,
        content,
      }))
    );

    if (error) throw new Error(error.message);
  }

  if (artifacts.tasks.length > 0) {
    const { error } = await supabase.from("meeting_tasks").insert(
      artifacts.tasks.map((task) => ({
        meeting_id: meetingId,
        workspace_id: workspaceId,
        user_id: userId,
        description: task.description,
        owner_name: task.owner || null,
        due_date: task.dueDate || null,
        status: "in_progress",
      }))
    );

    if (error) throw new Error(error.message);

    void notifyAssignees({ supabase, workspaceId, meetingTitle: resolvedTitle, tasks: artifacts.tasks });
  }

  return artifacts;
}

async function notifyAssignees({
  supabase,
  workspaceId,
  meetingTitle,
  tasks,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  meetingTitle: string;
  tasks: Array<{ description: string; owner: string | null; dueDate: string | null }>;
}) {
  const ownerNames = new Set(
    tasks.map((t) => (t.owner ?? "").trim().toLowerCase()).filter(Boolean)
  );
  if (ownerNames.size === 0) return;

  // Look up workspace members and match by email local-part or full email.
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (!members || members.length === 0) return;

  // We only have user_id in workspace_members; fetch emails via auth admin API
  // would require service role. Since we don't have that wired here, we match
  // by owner name stored on the task (e.g. an email the AI extracted).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  for (const task of tasks) {
    const owner = task.owner?.trim();
    if (!owner || !owner.includes("@")) continue;

    const { subject, html } = taskAssignedEmail({
      taskDescription: task.description,
      meetingTitle,
      dueDate: task.dueDate,
      appUrl,
    });
    try {
      await sendEmail({ to: owner, subject, html });
    } catch (err) {
      console.error("[task-assigned] email send failed", err);
    }
  }
}
