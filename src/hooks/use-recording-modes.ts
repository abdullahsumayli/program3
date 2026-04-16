"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AudioSource,
  AudioSourceHandlers,
  RealtimeToken,
  Recording,
} from "@soniox/client";

type RecordingState = "idle" | "starting" | "recording" | "stopping" | "error";
export type RecordingMode = "remote-share" | "mic-only";
type RecordingErrorStatus =
  | "api_error"
  | "api_key_fetch_failed"
  | "get_user_media_failed"
  | "media_recorder_error"
  | "queue_limit_exceeded"
  | "websocket_error";

export type RecordingDiagnosticsEvent =
  | { type: "session_started"; systemAudioActive: boolean }
  | { type: "system_audio_changed"; active: boolean }
  | {
      type: "session_reconnecting";
      attempt: number;
      status: RecordingErrorStatus;
      message: string;
    }
  | {
      type: "session_error";
      status: RecordingErrorStatus;
      message: string;
      reconnectCount: number;
    };

const SONIOX_MODEL = "stt-rt-v4";
const STARTING_TIMEOUT_MS = 20000;

export type SpeakerSegment = {
  speaker_id: number;
  text: string;
  start_ms: number;
  end_ms: number;
};

class MediaStreamAudioSource implements AudioSource {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream;
  private handlers: AudioSourceHandlers | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  async start(handlers: AudioSourceHandlers) {
    this.handlers = handlers;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    this.recorder = new MediaRecorder(this.stream, { mimeType, audioBitsPerSecond: 64000 });
    this.recorder.ondataavailable = async (e) => {
      if (e.data.size > 0) {
        const buf = await e.data.arrayBuffer();
        handlers.onData(buf);
      }
    };
    this.recorder.onerror = () => {
      handlers.onError(new Error("MediaRecorder error"));
    };
    this.recorder.start(60);
  }

  stop() {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    this.recorder = null;
    this.handlers = null;
  }

  pause() {
    if (this.recorder && this.recorder.state === "recording") {
      this.recorder.pause();
    }
  }

  resume() {
    if (this.recorder && this.recorder.state === "paused") {
      this.recorder.resume();
    }
  }
}

export function useRecordingModes(options?: {
  onDiagnosticsEvent?: (event: RecordingDiagnosticsEvent) => void;
}) {
  const [state, setState] = useState<RecordingState>("idle");
  const [finalTokens, setFinalTokens] = useState<RealtimeToken[]>([]);
  const [nonFinalTokens, setNonFinalTokens] = useState<RealtimeToken[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [systemAudioActive, setSystemAudioActive] = useState(false);

  const recordingRef = useRef<Recording | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const saveRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const finalTokensRef = useRef<RealtimeToken[]>([]);
  const nonFinalTokensRef = useRef<RealtimeToken[]>([]);
  const isStoppingRef = useRef(false);
  const hasStartedSessionRef = useRef(false);
  const systemAudioActiveRef = useRef(false);
  const startAttemptRef = useRef(0);

  const cleanupActiveResources = useCallback(() => {
    if (startingTimeoutRef.current) {
      clearTimeout(startingTimeoutRef.current);
      startingTimeoutRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recordingRef.current?.cancel();
    recordingRef.current = null;
    saveRecorderRef.current?.stop?.();
    saveRecorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    systemStreamRef.current?.getTracks().forEach((t) => t.stop());
    systemStreamRef.current = null;
    combinedStreamRef.current?.getTracks().forEach((t) => t.stop());
    combinedStreamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    setSystemAudioActive(false);
    systemAudioActiveRef.current = false;
  }, []);

  const startRecording = useCallback(async (mode: RecordingMode) => {
    const attemptId = ++startAttemptRef.current;
    setState("starting");
    setError(null);
    setFinalTokens([]);
    setNonFinalTokens([]);
    setElapsed(0);
    setAudioBlob(null);
    setSystemAudioActive(false);
    systemAudioActiveRef.current = false;
    audioChunksRef.current = [];
    finalTokensRef.current = [];
    nonFinalTokensRef.current = [];
    isStoppingRef.current = false;
    hasStartedSessionRef.current = false;

    if (startingTimeoutRef.current) clearTimeout(startingTimeoutRef.current);
    startingTimeoutRef.current = setTimeout(() => {
      if (attemptId === startAttemptRef.current && !hasStartedSessionRef.current && !isStoppingRef.current) {
        setError("Recording did not start. Approve the microphone or screen-share prompt, or cancel and try microphone only.");
        setState("error");
        cleanupActiveResources();
      }
    }, STARTING_TIMEOUT_MS);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (attemptId !== startAttemptRef.current) { micStream.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = micStream;

      let systemStream: MediaStream | null = null;
      if (mode === "remote-share") {
        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
          systemStream.getVideoTracks().forEach((t) => t.stop());
          if (systemStream.getAudioTracks().length === 0) systemStream = null;
        } catch { systemStream = null; }
      }
      if (attemptId !== startAttemptRef.current) { systemStream?.getTracks().forEach((t) => t.stop()); return; }
      systemStreamRef.current = systemStream;

      let combinedStream: MediaStream;
      if (systemStream) {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);
        ctx.createMediaStreamSource(systemStream).connect(dest);
        combinedStream = dest.stream;
        audioContextRef.current = ctx;
        setSystemAudioActive(true);
        systemAudioActiveRef.current = true;
        systemStream.getAudioTracks().forEach((track) => {
          track.onended = () => {
            setSystemAudioActive(false);
            systemAudioActiveRef.current = false;
            options?.onDiagnosticsEvent?.({ type: "system_audio_changed", active: false });
          };
        });
      } else {
        combinedStream = micStream;
        setSystemAudioActive(false);
        systemAudioActiveRef.current = false;
      }
      combinedStreamRef.current = combinedStream;

      const saveMime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const saveRecorder = new MediaRecorder(combinedStream, { mimeType: saveMime });
      saveRecorderRef.current = saveRecorder;
      saveRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      saveRecorder.onstop = () => { setAudioBlob(new Blob(audioChunksRef.current, { type: saveMime })); };
      saveRecorder.start(1000);

      const sonioxStream = combinedStream.clone();
      const { SonioxClient } = await import("@soniox/client");

      const client = new SonioxClient({
        api_key: async () => {
          console.info("[Soniox] Requesting temp key…");
          let res: Response;
          try {
            res = await fetch("/api/soniox-temp-key", { method: "POST" });
          } catch (err) {
            throw new Error(`Network error contacting /api/soniox-temp-key: ${err instanceof Error ? err.message : String(err)}`);
          }
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.api_key) {
            console.error("[Soniox] Temp key failed:", res.status, data);
            throw new Error(data.message || data.error || `Failed to get temp key (HTTP ${res.status})`);
          }
          console.info("[Soniox] Temp key received, connecting…");
          return data.api_key;
        },
      });

      const customSource = new MediaStreamAudioSource(sonioxStream);
      const recording = client.realtime.record({
        model: SONIOX_MODEL,
        language_hints: ["ar", "en"],
        enable_speaker_diarization: true,
        enable_endpoint_detection: true,
        source: customSource,
      });
      recordingRef.current = recording;

      recording.on("connected", () => {
        if (attemptId !== startAttemptRef.current) return;
        console.info("[Soniox] Session started, transcription active.");
        setError(null);
        setState("recording");
        if (startingTimeoutRef.current) { clearTimeout(startingTimeoutRef.current); startingTimeoutRef.current = null; }
        options?.onDiagnosticsEvent?.({ type: "session_started", systemAudioActive: systemAudioActiveRef.current });
        if (!hasStartedSessionRef.current) {
          hasStartedSessionRef.current = true;
          startTimeRef.current = Date.now();
          timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 500);
        }
      });

      recording.on("result", (result) => {
        if (attemptId !== startAttemptRef.current) return;
        const tokens = result.tokens ?? [];
        const newFinal = tokens.filter((t) => t.is_final);
        const newNonFinal = tokens.filter((t) => !t.is_final);
        if (newFinal.length > 0) {
          finalTokensRef.current = [...finalTokensRef.current, ...newFinal];
          setFinalTokens((prev) => [...prev, ...newFinal]);
        }
        nonFinalTokensRef.current = newNonFinal;
        setNonFinalTokens(newNonFinal);
      });

      recording.on("error", (err) => {
        if (attemptId !== startAttemptRef.current) return;
        console.error("[Soniox] Recording error:", err);
        options?.onDiagnosticsEvent?.({
          type: "session_error",
          status: "websocket_error",
          message: err.message,
          reconnectCount: 0,
        });
        setError(err.message);
        setState("error");
      });

    } catch (err) {
      if (attemptId !== startAttemptRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to start");
      setState("error");
      cleanupActiveResources();
    }
  }, [cleanupActiveResources, options]);

  const cancelStart = useCallback(() => {
    startAttemptRef.current += 1;
    isStoppingRef.current = false;
    hasStartedSessionRef.current = false;
    setError(null);
    setNonFinalTokens([]);
    cleanupActiveResources();
    setState("idle");
  }, [cleanupActiveResources]);

  const stopRecording = useCallback((): Promise<{
    transcript: string;
    segments: SpeakerSegment[];
    duration: number;
    audioBlob: Blob | null;
  }> => {
    return new Promise((resolve) => {
      isStoppingRef.current = true;
      setState("stopping");
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      const finish = () => {
        const allTokens = [...finalTokensRef.current, ...nonFinalTokensRef.current];
        const transcript = allTokens.map((t) => t.text).join("");
        const segments = buildSegments(allTokens);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        systemStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioContextRef.current?.close().catch(() => {});
        setSystemAudioActive(false);
        systemAudioActiveRef.current = false;

        const finalizeAudio = () => {
          const blob = audioChunksRef.current.length ? new Blob(audioChunksRef.current, { type: "audio/webm" }) : null;
          resolve({ transcript, segments, duration: finalDuration, audioBlob: blob });
        };

        const mr = saveRecorderRef.current;
        if (mr && mr.state !== "inactive") {
          let settled = false;
          const prevOnStop = mr.onstop;
          mr.onstop = (ev) => {
            if (typeof prevOnStop === "function") prevOnStop.call(mr, ev);
            if (!settled) { settled = true; finalizeAudio(); }
          };
          mr.stop();
          setTimeout(() => { if (!settled) { settled = true; finalizeAudio(); } }, 5000);
        } else {
          finalizeAudio();
        }
      };

      const rec = recordingRef.current;
      if (rec) {
        rec.stop().then(() => { setTimeout(finish, 150); }).catch(() => { finish(); });
        setTimeout(() => { finish(); }, 15000);
      } else {
        finish();
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      cleanupActiveResources();
    };
  }, [cleanupActiveResources]);

  useEffect(() => {
    if (state !== "recording") return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [state]);

  return {
    state,
    finalTokens,
    nonFinalTokens,
    error,
    elapsed,
    audioBlob,
    systemAudioActive,
    startRecording,
    cancelStart,
    stopRecording,
  };
}

function buildSegments(tokens: RealtimeToken[]): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  let current: SpeakerSegment | null = null;
  for (const token of tokens) {
    const text = token.text;
    if (!text) continue;
    const speakerId = parseInt(token.speaker ?? "1", 10) || 1;
    if (!current || current.speaker_id !== speakerId) {
      if (current) segments.push(current);
      current = { speaker_id: speakerId, text, start_ms: token.start_ms ?? 0, end_ms: token.end_ms ?? 0 };
    } else {
      current.text += text;
      current.end_ms = token.end_ms ?? current.end_ms;
    }
  }
  if (current) segments.push(current);
  return segments;
}
