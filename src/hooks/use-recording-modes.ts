"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SonioxClient, type Token } from "@soniox/speech-to-text-web";

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
const SONIOX_KEEPALIVE_INTERVAL_MS = 5000;
const MAX_SONIOX_RETRIES = 3;
const SONIOX_RETRY_DELAY_MS = 1000;
const STARTING_TIMEOUT_MS = 20000;

export type SpeakerSegment = {
  speaker_id: number;
  text: string;
  start_ms: number;
  end_ms: number;
};

export function useRecordingModes(options?: {
  onDiagnosticsEvent?: (event: RecordingDiagnosticsEvent) => void;
}) {
  const [state, setState] = useState<RecordingState>("idle");
  const [finalTokens, setFinalTokens] = useState<Token[]>([]);
  const [nonFinalTokens, setNonFinalTokens] = useState<Token[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [systemAudioActive, setSystemAudioActive] = useState(false);

  const clientRef = useRef<SonioxClient | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const finalTokensRef = useRef<Token[]>([]);
  const nonFinalTokensRef = useRef<Token[]>([]);
  const finishCallbackRef = useRef<(() => void) | null>(null);
  const isStoppingRef = useRef(false);
  const hasStartedSessionRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const systemAudioActiveRef = useRef(false);
  const startAttemptRef = useRef(0);

  const cleanupActiveResources = useCallback(() => {
    if (startingTimeoutRef.current) {
      clearTimeout(startingTimeoutRef.current);
      startingTimeoutRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    clientRef.current?.cancel();
    clientRef.current = null;
    mediaRecorderRef.current?.stop?.();
    mediaRecorderRef.current = null;
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
    finishCallbackRef.current = null;
    isStoppingRef.current = false;
    hasStartedSessionRef.current = false;
    reconnectAttemptsRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (startingTimeoutRef.current) {
      clearTimeout(startingTimeoutRef.current);
    }
    startingTimeoutRef.current = setTimeout(() => {
      if (attemptId === startAttemptRef.current && !hasStartedSessionRef.current && !isStoppingRef.current) {
        setError(
          "Recording did not start. Approve the microphone or screen-share prompt, or cancel and try microphone only."
        );
        setState("error");
        cleanupActiveResources();
      }
    }, STARTING_TIMEOUT_MS);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (attemptId !== startAttemptRef.current) {
        micStream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = micStream;

      let systemStream: MediaStream | null = null;
      if (mode === "remote-share") {
        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
          });
          systemStream.getVideoTracks().forEach((t) => t.stop());
          if (systemStream.getAudioTracks().length === 0) {
            systemStream = null;
          }
        } catch {
          systemStream = null;
        }
      }
      if (attemptId !== startAttemptRef.current) {
        systemStream?.getTracks().forEach((t) => t.stop());
        return;
      }
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
            options?.onDiagnosticsEvent?.({
              type: "system_audio_changed",
              active: false,
            });
          };
        });
      } else {
        combinedStream = micStream;
        setSystemAudioActive(false);
        systemAudioActiveRef.current = false;
      }
      combinedStreamRef.current = combinedStream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
      };
      mediaRecorder.start(1000);

      const startSonioxSession = async () => {
        const sourceStream = combinedStreamRef.current;
        if (!sourceStream || sourceStream.getAudioTracks().length === 0) {
          throw new Error("Recording audio stream is unavailable");
        }
        if (attemptId !== startAttemptRef.current) return;

        const sonioxStream = sourceStream.clone();
        const client = new SonioxClient({
          apiKey: async () => {
            let res: Response;
            try {
              res = await fetch("/api/soniox-temp-key", { method: "POST" });
            } catch (err) {
              throw new Error(
                `Network error contacting /api/soniox-temp-key: ${
                  err instanceof Error ? err.message : String(err)
                }`
              );
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.api_key) {
              throw new Error(
                data.message ||
                  data.error ||
                  `Failed to get temp key (HTTP ${res.status})`
              );
            }
            return data.api_key;
          },
          keepAlive: true,
          keepAliveInterval: SONIOX_KEEPALIVE_INTERVAL_MS,
          onStarted: () => {
            if (attemptId !== startAttemptRef.current) return;
            reconnectAttemptsRef.current = 0;
            setError(null);
            setState("recording");
            if (startingTimeoutRef.current) {
              clearTimeout(startingTimeoutRef.current);
              startingTimeoutRef.current = null;
            }
            options?.onDiagnosticsEvent?.({
              type: "session_started",
              systemAudioActive: systemAudioActiveRef.current,
            });
            if (!hasStartedSessionRef.current) {
              hasStartedSessionRef.current = true;
              startTimeRef.current = Date.now();
              timerRef.current = setInterval(() => {
                setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
              }, 500);
            }
          },
          onPartialResult: (result) => {
            if (attemptId !== startAttemptRef.current) return;
            const tokens = result.tokens ?? [];
            const newFinal = tokens.filter((t) => t.is_final);
            const newNonFinal = tokens.filter((t) => !t.is_final);

            if (newFinal.length > 0) {
              finalTokensRef.current = [...finalTokensRef.current, ...newFinal];
            }
            nonFinalTokensRef.current = newNonFinal;

            if (newFinal.length > 0) {
              setFinalTokens((prev) => [...prev, ...newFinal]);
            }
            setNonFinalTokens(newNonFinal);
          },
          onFinished: () => {
            clientRef.current = null;
            if (isStoppingRef.current) {
              if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
              }
              finishCallbackRef.current?.();
            }
          },
          onError: (status, message) => {
            if (attemptId !== startAttemptRef.current) return;
            clientRef.current = null;
            if (startingTimeoutRef.current) {
              clearTimeout(startingTimeoutRef.current);
              startingTimeoutRef.current = null;
            }

            const canRetry =
              !isStoppingRef.current &&
              combinedStreamRef.current?.getAudioTracks().some((track) => track.readyState === "live") &&
              reconnectAttemptsRef.current < MAX_SONIOX_RETRIES &&
              (status === "websocket_error" ||
                status === "media_recorder_error" ||
                status === "api_error" ||
                status === "queue_limit_exceeded");

            if (canRetry) {
              reconnectAttemptsRef.current += 1;
              options?.onDiagnosticsEvent?.({
                type: "session_reconnecting",
                attempt: reconnectAttemptsRef.current,
                status,
                message,
              });
              retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                void startSonioxSession().catch((retryErr) => {
                  if (attemptId !== startAttemptRef.current) return;
                  setError(
                    retryErr instanceof Error ? retryErr.message : "Failed to restart transcription"
                  );
                  setState("error");
                  finishCallbackRef.current?.();
                });
              }, SONIOX_RETRY_DELAY_MS);
              return;
            }

            options?.onDiagnosticsEvent?.({
              type: "session_error",
              status,
              message,
              reconnectCount: reconnectAttemptsRef.current,
            });
            setError(message);
            setState("error");
            finishCallbackRef.current?.();
          },
        });

        clientRef.current = client;

        await client.start({
          model: SONIOX_MODEL,
          languageHints: ["ar", "en"],
          enableSpeakerDiarization: true,
          enableEndpointDetection: true,
          stream: sonioxStream,
        });
      };

      await startSonioxSession();
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
    reconnectAttemptsRef.current = 0;
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      const finish = () => {
        const allTokens = [...finalTokensRef.current, ...nonFinalTokensRef.current];
        const transcript = allTokens.map((t) => t.text.replace(/<end>/gi, "")).join("");
        const segments = buildSegments(allTokens);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        systemStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioContextRef.current?.close().catch(() => {});
        setSystemAudioActive(false);
        systemAudioActiveRef.current = false;

        const finalizeAudio = () => {
          const blob = audioChunksRef.current.length
            ? new Blob(audioChunksRef.current, { type: "audio/webm" })
            : null;
          resolve({ transcript, segments, duration: finalDuration, audioBlob: blob });
        };

        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== "inactive") {
          let settled = false;
          const prevOnStop = mr.onstop;
          mr.onstop = (ev) => {
            if (typeof prevOnStop === "function") {
              prevOnStop.call(mr, ev);
            }
            if (!settled) {
              settled = true;
              finalizeAudio();
            }
          };
          mr.stop();
          setTimeout(() => {
            if (!settled) {
              settled = true;
              finalizeAudio();
            }
          }, 5000);
        } else {
          finalizeAudio();
        }
      };

      if (clientRef.current) {
        let finished = false;
        const onDone = () => {
          if (finished) return;
          finished = true;
          finishCallbackRef.current = null;
          setTimeout(finish, 150);
        };
        finishCallbackRef.current = onDone;
        clientRef.current.stop();
        setTimeout(() => {
          if (!finished) onDone();
        }, 15000);
      } else {
        finish();
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      cleanupActiveResources();
    };
  }, [cleanupActiveResources, options]);

  useEffect(() => {
    if (state !== "recording") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
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

function buildSegments(tokens: Token[]): SpeakerSegment[] {
  const segments: SpeakerSegment[] = [];
  let current: SpeakerSegment | null = null;

  for (const token of tokens) {
    const text = token.text.replace(/<end>/gi, "");
    if (!text) continue;
    const speakerId = parseInt(token.speaker ?? "1", 10) || 1;
    if (!current || current.speaker_id !== speakerId) {
      if (current) segments.push(current);
      current = {
        speaker_id: speakerId,
        text,
        start_ms: token.start_ms ?? 0,
        end_ms: token.end_ms ?? 0,
      };
    } else {
      current.text += text;
      current.end_ms = token.end_ms ?? current.end_ms;
    }
  }
  if (current) segments.push(current);
  return segments;
}
