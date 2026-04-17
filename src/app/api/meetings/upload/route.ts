import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/supabase/auth";
import { buildTranscriptSegmentsFromTokens, processMeetingArtifacts } from "@/lib/meeting-processing";
import { enforceQuota } from "@/lib/billing/enforce";

const BUCKET = "meeting-audio";
const SONIOX_BASE_URL = "https://api.soniox.com/v1";
const SONIOX_MODEL = "stt-async-preview";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav",
  "audio/x-wav", "audio/mp3", "audio/aac", "video/webm", "video/mp4",
]);

export async function POST(request: Request) {
  const auth = await requireWorkspace();
  if (auth.error) return auth.error;
  const { user, supabase, workspace } = auth;

  const blocked = await enforceQuota(supabase, workspace);
  if (blocked) return blocked;

  const formData = await request.formData();
  const file = formData.get("audio");
  const title = String(formData.get("title") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum size is 500 MB." }, { status: 413 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: "Invalid file type. Only audio and video files are accepted." }, { status: 415 });
  }

  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SONIOX_API_KEY missing" }, { status: 500 });
  }

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "webm";
  const filename = `${workspace.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, arrayBuffer, { contentType: file.type || "application/octet-stream", upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const sonioxFileForm = new FormData();
  sonioxFileForm.append("file", new Blob([arrayBuffer], { type: file.type || "application/octet-stream" }), file.name);
  sonioxFileForm.append("client_reference_id", workspace.id);

  const uploadToSoniox = await fetch(`${SONIOX_BASE_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: sonioxFileForm,
  });

  if (!uploadToSoniox.ok) {
    console.error("[meetings/upload] Soniox file upload error:", await uploadToSoniox.text());
    return NextResponse.json({ error: "Transcription service unavailable" }, { status: 502 });
  }

  const sonioxFile = await uploadToSoniox.json();

  const createTranscription = await fetch(`${SONIOX_BASE_URL}/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: SONIOX_MODEL,
      file_id: sonioxFile.id,
      language_hints: ["ar", "en"],
      enable_speaker_diarization: true,
      enable_language_identification: true,
      client_reference_id: workspace.id,
    }),
  });

  if (!createTranscription.ok) {
    console.error("[meetings/upload] Soniox transcription error:", await createTranscription.text());
    return NextResponse.json({ error: "Transcription service unavailable" }, { status: 502 });
  }

  const transcription = await createTranscription.json();
  const completed = await waitForTranscription(apiKey, transcription.id);
  const transcriptResponse = await fetch(`${SONIOX_BASE_URL}/transcriptions/${transcription.id}/transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!transcriptResponse.ok) {
    console.error("[meetings/upload] Soniox transcript fetch error:", await transcriptResponse.text());
    return NextResponse.json({ error: "Transcription service unavailable" }, { status: 502 });
  }

  const transcriptPayload = await transcriptResponse.json();
  const transcript = String(transcriptPayload.text ?? "");
  const transcriptSegments = buildTranscriptSegmentsFromTokens(Array.isArray(transcriptPayload.tokens) ? transcriptPayload.tokens : []);
  const duration = Math.ceil(Number(completed.audio_duration_ms ?? 0) / 1000);

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      title: title || null,
      transcript,
      transcript_segments: transcriptSegments,
      duration,
      audio_url: filename,
      source_type: "uploaded_recording",
      processing_status: "processing",
      processing_error: null,
    })
    .select()
    .single();

  if (meetingError || !meeting) {
    return NextResponse.json({ error: meetingError?.message ?? "Failed to create meeting" }, { status: 500 });
  }

  try {
    await processMeetingArtifacts({
      supabase,
      userId: user.id,
      workspaceId: workspace.id,
      meetingId: meeting.id,
      transcript,
      fallbackTitle: title || null,
    });
  } catch (error) {
    console.error("[meetings/upload] processing error:", error);
    await supabase
      .from("meetings")
      .update({
        processing_status: "error",
        processing_error: error instanceof Error ? error.message : "Processing failed",
      })
      .eq("id", meeting.id)
      .eq("workspace_id", workspace.id);
    return NextResponse.json({ error: "Meeting processing failed" }, { status: 500 });
  }

  return NextResponse.json({ id: meeting.id });
}

async function waitForTranscription(apiKey: string, transcriptionId: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const response = await fetch(`${SONIOX_BASE_URL}/transcriptions/${transcriptionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    if (data.status === "completed") return data;
    if (data.status === "error") throw new Error(data.error_message || "Transcription failed");

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Transcription timed out");
}
