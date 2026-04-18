"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Headphones, Laptop2, Loader2, Mic, Save, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTranscript } from "./live-transcript";
import { MicTest } from "./mic-test";
import {
  type RecordingDiagnosticsEvent,
  type RecordingMode,
  type SpeakerSegment,
  useRecordingModes,
} from "@/hooks/use-recording-modes";
import { useLanguage } from "@/lib/i18n/context";
import { formatDuration } from "@/lib/utils";

type CapturedRecording = {
  transcript: string;
  segments: SpeakerSegment[];
  duration: number;
  audioBlob: Blob | null;
};

type SavedMeeting = {
  id: string;
  title: string | null;
};

const DRAFT_KEY = "alaa-recording-draft";

export function RecordingSession({ onFinished }: { onFinished: () => void }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<"stopping" | "saving" | "summarizing" | null>(null);
  const [selectedMode, setSelectedMode] = useState<RecordingMode>("remote-share");
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const [capturedRecording, setCapturedRecording] = useState<CapturedRecording | null>(null);
  const [savedMeeting, setSavedMeeting] = useState<SavedMeeting | null>(null);
  const [postStopError, setPostStopError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const recordingSessionIdRef = useRef<string | null>(null);
  const interruptionCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const systemAudioActiveRef = useRef(false);

  const updateRecordingSession = useCallback(async (payload: Record<string, unknown>) => {
    const sessionId = recordingSessionIdRef.current;
    if (!sessionId) return;

    try {
      await fetch(`/api/recording-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to update recording session", error);
    }
  }, []);

  const handleDiagnosticsEvent = useCallback((event: RecordingDiagnosticsEvent) => {
    if (event.type === "session_started") {
      void updateRecordingSession({
        status: "recording",
        system_audio_active: event.systemAudioActive,
        last_error_status: null,
        last_error_message: null,
      });
      return;
    }

    if (event.type === "system_audio_changed") {
      void updateRecordingSession({ system_audio_active: event.active, duration_seconds: elapsedRef.current });
      return;
    }

    if (event.type === "session_reconnecting") {
      interruptionCountRef.current = event.attempt;
      void updateRecordingSession({
        status: "recording",
        interruption_count: event.attempt,
        duration_seconds: elapsedRef.current,
        last_error_status: event.status,
        last_error_message: event.message,
      });
      return;
    }

    interruptionCountRef.current = event.reconnectCount;
    void updateRecordingSession({
      status: event.status === "get_user_media_failed" || event.status === "api_key_fetch_failed" ? "error" : "interrupted",
      interruption_count: event.reconnectCount,
      duration_seconds: elapsedRef.current,
      ended_at: new Date().toISOString(),
      last_error_status: event.status,
      last_error_message: event.message,
    });
  }, [updateRecordingSession]);

  const recording = useRecordingModes({ onDiagnosticsEvent: handleDiagnosticsEvent });

  useEffect(() => {
    const draft = readRecordingDraft();
    if (!draft) return;

    setCapturedRecording({
      transcript: draft.transcript,
      segments: [],
      duration: draft.duration,
      audioBlob: null,
    });
    setDraftRestored(true);
  }, []);

  useEffect(() => {
    if (recording.state !== "recording") return;

    const transcript = getTranscriptText([
      ...recording.finalTokens,
      ...recording.nonFinalTokens,
    ]);
    if (!transcript.trim()) return;

    writeRecordingDraft({
      transcript,
      duration: recording.elapsed,
      savedAt: new Date().toISOString(),
    });
  }, [recording.elapsed, recording.finalTokens, recording.nonFinalTokens, recording.state]);

  useEffect(() => {
    recordingSessionIdRef.current = recordingSessionId;
  }, [recordingSessionId]);

  useEffect(() => {
    elapsedRef.current = recording.elapsed;
    systemAudioActiveRef.current = recording.systemAudioActive;
  }, [recording.elapsed, recording.systemAudioActive]);

  useEffect(() => {
    if (!recordingSessionId || recording.state !== "recording") return;

    const heartbeat = () => {
      void updateRecordingSession({
        status: "recording",
        duration_seconds: elapsedRef.current,
        interruption_count: interruptionCountRef.current,
        system_audio_active: systemAudioActiveRef.current,
        last_heartbeat_at: new Date().toISOString(),
      });
    };

    heartbeat();
    const interval = setInterval(heartbeat, 30000);
    return () => clearInterval(interval);
  }, [recording.state, recordingSessionId, updateRecordingSession]);

  const handleStart = async () => {
    interruptionCountRef.current = 0;
    setRecordingSessionId(null);
    setCapturedRecording(null);
    setSavedMeeting(null);
    setPostStopError(null);
    setDraftRestored(false);
    clearRecordingDraft();
    recordingSessionIdRef.current = null;

    const res = await fetch("/api/recording-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recording_mode: selectedMode,
        status: "starting",
        system_audio_requested: selectedMode === "remote-share",
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to start recording" }));
      alert(data.error ?? "Failed to start recording");
      return;
    }

    const session = await res.json();
    setRecordingSessionId(session.id);
    recordingSessionIdRef.current = session.id;
    await recording.startRecording(selectedMode);
  };

  const handleCancelStart = async () => {
    recording.cancelStart();
    await updateRecordingSession({
      status: "error",
      ended_at: new Date().toISOString(),
      last_error_status: "start_cancelled",
      last_error_message: "Recording start was cancelled before the session became active.",
    });
    setRecordingSessionId(null);
    recordingSessionIdRef.current = null;
  };

  const handleStop = async () => {
    setBusyAction("stopping");
    setPostStopError(null);
    try {
      const stopped = await recording.stopRecording();
      const captured = {
        transcript: stopped.transcript,
        segments: stopped.segments,
        duration: stopped.duration,
        audioBlob: stopped.audioBlob,
      };
      setCapturedRecording(captured);
      writeRecordingDraft({
        transcript: captured.transcript,
        duration: captured.duration,
        savedAt: new Date().toISOString(),
      });

      await updateRecordingSession({
        status: "completed",
        duration_seconds: captured.duration,
        ended_at: new Date().toISOString(),
        interruption_count: interruptionCountRef.current,
        system_audio_active: systemAudioActiveRef.current,
      });
    } catch (error) {
      console.error(error);
      await updateRecordingSession({
        status: "error",
        ended_at: new Date().toISOString(),
        interruption_count: interruptionCountRef.current,
        last_error_status: "post_processing_error",
        last_error_message: error instanceof Error ? error.message : "Failed to stop recording",
      });
      setPostStopError(error instanceof Error ? error.message : "Failed to stop recording");
    } finally {
      setBusyAction(null);
    }
  };

  const uploadAudioInBackground = useCallback(
    async (meetingId: string, audioBlob: Blob | null) => {
      if (!audioBlob) return;

      try {
        const form = new FormData();
        form.append("audio", audioBlob, "meeting.webm");
        const uploadRes = await fetch("/api/upload-audio", {
          method: "POST",
          body: form,
        });
        if (!uploadRes.ok) return;

        const uploaded = await uploadRes.json();
        if (!uploaded.path) return;

        await fetch(`/api/meetings/${meetingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: uploaded.path }),
        });
      } catch (error) {
        console.error("Audio upload failed after transcript save", error);
      }
    },
    []
  );

  const saveTranscript = useCallback(async () => {
    if (savedMeeting) return savedMeeting;
    if (!capturedRecording) return null;

    setBusyAction("saving");
    setPostStopError(null);

    try {
      const createRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: capturedRecording.transcript,
          transcript_segments: capturedRecording.segments,
          duration: capturedRecording.duration,
          audio_url: null,
          source_type: "live_recording",
          processing_status: "completed",
        }),
      });
      const meeting = await createRes.json();
      if (!createRes.ok || !meeting.id) {
        throw new Error(meeting.error ?? "Failed to save transcript");
      }

      const nextMeeting = {
        id: meeting.id as string,
        title: (meeting.title as string | null) ?? null,
      };
      setSavedMeeting(nextMeeting);
      clearRecordingDraft();

      await updateRecordingSession({
        status: "completed",
        duration_seconds: capturedRecording.duration,
        ended_at: new Date().toISOString(),
        meeting_id: nextMeeting.id,
        interruption_count: interruptionCountRef.current,
        system_audio_active: systemAudioActiveRef.current,
      });

      void uploadAudioInBackground(nextMeeting.id, capturedRecording.audioBlob);
      return nextMeeting;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save transcript";
      setPostStopError(message);
      return null;
    } finally {
      setBusyAction(null);
    }
  }, [capturedRecording, savedMeeting, updateRecordingSession, uploadAudioInBackground]);

  const summarizeTranscript = useCallback(async () => {
    setBusyAction("summarizing");
    setPostStopError(null);

    try {
      const meeting = savedMeeting ?? (await saveTranscript());
      if (!meeting || !capturedRecording) {
        throw new Error("Save the transcript before summarizing.");
      }
      setBusyAction("summarizing");

      const summaryRes = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          transcript: capturedRecording.transcript,
          fallbackTitle: meeting.title,
        }),
      });
      const summary = await summaryRes.json().catch(() => ({}));
      if (!summaryRes.ok) {
        throw new Error(summary.error ?? "Failed to summarize meeting");
      }

      onFinished();
      router.push(`/meetings/${meeting.id}`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to summarize meeting";
      setPostStopError(message);
    } finally {
      setBusyAction(null);
    }
  }, [capturedRecording, onFinished, router, saveTranscript, savedMeeting]);

  const isIdle = recording.state === "idle";
  const isRecording = recording.state === "recording";
  const isStarting = recording.state === "starting";
  const isStopping = recording.state === "stopping" || busyAction === "stopping";
  const hasCaptured = capturedRecording !== null;
  const isBusy = busyAction !== null;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isRecording && (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm font-medium text-slate-900">{t("recording.recording")}</span>
              </div>
              <span className="font-mono text-sm text-slate-600">{formatDuration(recording.elapsed)}</span>
            </>
          )}
          {isIdle && !hasCaptured && <MicTest />}
          {isStarting && <span className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" />{t("recording.starting")}</span>}
          {isStopping && <span className="flex items-center gap-2 text-sm text-slate-600"><Loader2 size={14} className="animate-spin" />{t("recording.stopping")}</span>}
          {savedMeeting && (
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 size={15} />
              {t("recording.saved")}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isIdle && !hasCaptured && <Button onClick={handleStart} size="lg"><Mic size={18} />{t("recording.startMeeting")}</Button>}
          {isRecording && <Button onClick={handleStop} variant="danger" size="lg"><Square size={16} />{t("recording.stop")}</Button>}
          {hasCaptured && (
            <>
              <Button
                onClick={() => void saveTranscript()}
                disabled={isBusy || Boolean(savedMeeting)}
                size="lg"
              >
                {busyAction === "saving" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savedMeeting ? t("recording.saved") : t("recording.saveTranscript")}
              </Button>
              <Button
                onClick={() => void summarizeTranscript()}
                disabled={isBusy}
                size="lg"
                variant="outline"
              >
                {busyAction === "summarizing" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {t("recording.summarizeMeeting")}
              </Button>
            </>
          )}
          {isStarting && <Button variant="ghost" onClick={() => void handleCancelStart()}>{t("common.cancel")}</Button>}
          {(isIdle || hasCaptured) && <Button variant="ghost" onClick={onFinished}>{t("common.cancel")}</Button>}
        </div>
      </div>

      {busyAction === "summarizing" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {t("recording.summarizing")}
        </div>
      )}

      {draftRestored && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t("recording.draftRestored")}
        </div>
      )}

      {savedMeeting && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {t("recording.savedHint")}
        </div>
      )}

      {isStarting && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
          {t("recording.startingHelp")}
        </div>
      )}

      {isIdle && !hasCaptured && (
        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <RecordingModeCard icon={<Laptop2 size={18} />} title={t("recording.remoteTitle")} description={t("recording.remoteDescription")} detail={t("recording.remoteDetail")} selected={selectedMode === "remote-share"} onSelect={() => setSelectedMode("remote-share")} />
          <RecordingModeCard icon={<Headphones size={18} />} title={t("recording.micTitle")} description={t("recording.micDescription")} detail={t("recording.micDetail")} selected={selectedMode === "mic-only"} onSelect={() => setSelectedMode("mic-only")} />
        </div>
      )}

      {recording.error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{recording.error}</div>}
      {postStopError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{postStopError}</div>}

      {isRecording && (
        <div className={`mb-4 rounded-lg border p-3 text-sm ${recording.systemAudioActive ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
          {recording.systemAudioActive ? t("recording.systemAudioOn") : t("recording.systemAudioOff")}
        </div>
      )}

      {(isRecording || recording.finalTokens.length > 0) ? (
        <LiveTranscript finalTokens={recording.finalTokens} nonFinalTokens={recording.nonFinalTokens} />
      ) : capturedRecording ? (
        <TranscriptPreview transcript={capturedRecording.transcript} />
      ) : null}
    </div>
  );
}

function TranscriptPreview({ transcript }: { transcript: string }) {
  return (
    <div className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-7 text-gray-900">
      {transcript.trim() ? transcript : "..."}
    </div>
  );
}

function RecordingModeCard({ icon, title, description, detail, selected, onSelect }: { icon: ReactNode; title: string; description: string; detail: string; selected: boolean; onSelect: () => void; }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-start transition ${selected ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-900">{icon}</div>
      <div className="mb-1 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mb-2 text-sm text-slate-700">{description}</div>
      <div className="text-xs leading-5 text-slate-500">{detail}</div>
    </button>
  );
}

type RecordingDraft = {
  transcript: string;
  duration: number;
  savedAt: string;
};

type TranscriptToken = {
  text?: string | null;
};

function getTranscriptText(tokens: TranscriptToken[]) {
  return tokens
    .map((token) => token.text?.replace(/<end>/gi, "") ?? "")
    .join("");
}

function readRecordingDraft(): RecordingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecordingDraft;
    if (!parsed.transcript?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeRecordingDraft(draft: RecordingDraft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Local draft is best-effort only; database save remains the source of truth.
  }
}

function clearRecordingDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // no-op
  }
}
