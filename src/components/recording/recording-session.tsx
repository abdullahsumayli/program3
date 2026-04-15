"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Headphones, Laptop2, Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveTranscript } from "./live-transcript";
import { MicTest } from "./mic-test";
import {
  type RecordingDiagnosticsEvent,
  type RecordingMode,
  useRecordingModes,
} from "@/hooks/use-recording-modes";
import { useLanguage } from "@/lib/i18n/context";
import { formatDuration } from "@/lib/utils";
import type { TrackType } from "@/lib/supabase/types";

export function RecordingSession({
  trackId,
  trackType,
  onFinished,
}: {
  trackId: string;
  trackType: TrackType;
  onFinished: () => void;
}) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const [summarizing, setSummarizing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<RecordingMode>("remote-share");
  const [recordingSessionId, setRecordingSessionId] = useState<string | null>(null);
  const recordingSessionIdRef = useRef<string | null>(null);
  const interruptionCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const systemAudioActiveRef = useRef(false);
  const isLecture = trackType === "lectures";
  const modeCopy =
    locale === "ar"
      ? {
          remoteTitle: "مشاركة اجتماع عن بعد",
          remoteDescription:
            "شارك الشاشة مع الصوت حتى تسمع وتسجل صوت الطرف الثاني في الاجتماع البعيد.",
          remoteDetail:
            "هذا الخيار مناسب لاجتماعات Zoom وMeet وTeams أو أي محادثة عن بعد تعمل من اللابتوب.",
          micTitle: "الميكروفون فقط",
          micDescription:
            "استخدم ميكروفون اللابتوب أو الجوال إذا كنت حاضرًا شخصيًا داخل قاعة الاجتماع أو قاعة المحاضرة.",
          micDetail:
            "هذا الخيار مناسب عندما تكون موجودًا في نفس المكان وتريد تسجيل الأصوات القريبة مباشرة."
        }
       : {
          remoteTitle: "Remote meeting sharing",
          remoteDescription:
            "Share the meeting with audio so you can hear and record the other participant.",
          remoteDetail:
            "Best for Zoom, Meet, Teams, or any remote conversation playing through the laptop.",
          micTitle: "Microphone only",
          micDescription:
            "Use the laptop or phone microphone when you are physically inside the meeting or lecture room.",
          micDetail:
             "Best when you are present in the room and want to capture nearby voices directly."
         };

  const updateRecordingSession = useCallback(
    async (payload: Record<string, unknown>) => {
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
    },
    []
  );

  const handleDiagnosticsEvent = useCallback(
    (event: RecordingDiagnosticsEvent) => {
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
        void updateRecordingSession({
          system_audio_active: event.active,
          duration_seconds: elapsedRef.current,
        });
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
        status:
          event.status === "get_user_media_failed" || event.status === "api_key_fetch_failed"
            ? "error"
            : "interrupted",
        interruption_count: event.reconnectCount,
        duration_seconds: elapsedRef.current,
        ended_at: new Date().toISOString(),
        last_error_status: event.status,
        last_error_message: event.message,
      });
    },
    [updateRecordingSession]
  );

  const recording = useRecordingModes({
    onDiagnosticsEvent: handleDiagnosticsEvent,
  });

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
  }, [
    recording.elapsed,
    recording.state,
    recording.systemAudioActive,
    recordingSessionId,
    updateRecordingSession,
  ]);

  const handleStart = async () => {
    interruptionCountRef.current = 0;
    setRecordingSessionId(null);
    recordingSessionIdRef.current = null;

    try {
      const res = await fetch("/api/recording-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: trackId,
          recording_mode: selectedMode,
          status: "starting",
          system_audio_requested: selectedMode === "remote-share",
        }),
      });

      if (res.ok) {
        const session = await res.json();
        setRecordingSessionId(session.id);
        recordingSessionIdRef.current = session.id;
      }
    } catch (error) {
      console.error("Failed to create recording session", error);
    }

    await recording.startRecording(selectedMode);
  };

  const handleStop = async () => {
    const { transcript, segments, duration, audioBlob } = await recording.stopRecording();
    setSummarizing(true);

    try {
      // Upload audio if we have a blob. audio_url stores the storage path;
      // the meeting page server-side mints a short-lived signed URL for playback.
      let audioPath: string | null = null;
      if (audioBlob) {
        try {
          const form = new FormData();
          form.append("audio", audioBlob, "meeting.webm");
          const uploadRes = await fetch("/api/upload-audio", { method: "POST", body: form });
          if (uploadRes.ok) {
            const u = await uploadRes.json();
            audioPath = u.path ?? null;
          }
        } catch {}
      }

      // Create meeting row
      const createRes = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_id: trackId,
          transcript,
          transcript_segments: segments,
          duration,
          audio_url: audioPath,
        }),
      });
      const meeting = await createRes.json();

      await updateRecordingSession({
        status: "completed",
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
        meeting_id: meeting.id ?? null,
        interruption_count: interruptionCountRef.current,
        system_audio_active: systemAudioActiveRef.current,
      });

      // Summarize
      await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, transcript, trackType }),
      });

      onFinished();
      router.push(`/track/${trackId}/meeting/${meeting.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      await updateRecordingSession({
        status: "error",
        duration_seconds: duration,
        ended_at: new Date().toISOString(),
        interruption_count: interruptionCountRef.current,
        last_error_status: "post_processing_error",
        last_error_message: err instanceof Error ? err.message : "Failed to save recording",
      });
      setSummarizing(false);
    }
  };

  const isIdle = recording.state === "idle";
  const isRecording = recording.state === "recording";
  const isStarting = recording.state === "starting";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      {summarizing ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 size={32} className="animate-spin text-blue-600" />
          <p className="text-gray-700">{t("recording.summarizing")}</p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isRecording && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                    <span className="text-sm font-medium text-gray-900">
                      {t("recording.recording")}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-gray-600">
                    {formatDuration(recording.elapsed)}
                  </span>
                </>
              )}
              {isIdle && <MicTest />}
              {isStarting && (
                <span className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 size={14} className="animate-spin" />
                  {t("recording.starting")}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {isIdle && (
                <Button onClick={handleStart} size="lg">
                  <Mic size={18} />
                  {t(isLecture ? "track.startLecture" : "track.startMeeting")}
                </Button>
              )}
              {isRecording && (
                <Button onClick={handleStop} variant="danger" size="lg">
                  <Square size={16} />
                  {t("recording.stop")}
                </Button>
              )}
              {isIdle && (
                <Button variant="ghost" onClick={onFinished}>
                  {t("common.cancel")}
                </Button>
              )}
            </div>
          </div>

          {isIdle && (
            <div className="mb-5 grid gap-3 md:grid-cols-2">
              <RecordingModeCard
                icon={<Laptop2 size={18} />}
                title={modeCopy.remoteTitle}
                description={modeCopy.remoteDescription}
                detail={modeCopy.remoteDetail}
                selected={selectedMode === "remote-share"}
                onSelect={() => setSelectedMode("remote-share")}
              />
              <RecordingModeCard
                icon={<Headphones size={18} />}
                title={modeCopy.micTitle}
                description={modeCopy.micDescription}
                detail={modeCopy.micDetail}
                selected={selectedMode === "mic-only"}
                onSelect={() => setSelectedMode("mic-only")}
              />
            </div>
          )}

          {recording.error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {recording.error}
            </div>
          )}

          {isRecording && (
            <div className={`mb-4 rounded-lg border p-3 text-sm ${
              recording.systemAudioActive
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              {recording.systemAudioActive
                ? t("recording.systemAudioOn")
                : t("recording.systemAudioOff")}
            </div>
          )}

          {(isRecording || recording.finalTokens.length > 0) && (
            <LiveTranscript
              finalTokens={recording.finalTokens}
              nonFinalTokens={recording.nonFinalTokens}
            />
          )}
        </>
      )}
    </div>
  );
}

function RecordingModeCard({
  icon,
  title,
  description,
  detail,
  selected,
  onSelect,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`rounded-xl border p-4 text-start transition ${
        selected
          ? "border-blue-500 bg-blue-50 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-blue-600">
        {icon}
      </div>
      <div className="mb-1 text-sm font-semibold text-gray-900">{title}</div>
      <div className="mb-2 text-sm text-gray-700">{description}</div>
      <div className="text-xs leading-5 text-gray-500">{detail}</div>
    </button>
  );
}
