"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SonioxClient, type Token } from "@soniox/speech-to-text-web";

type RecordingState = "idle" | "starting" | "recording" | "stopping" | "error";

export type SpeakerSegment = {
  speaker_id: number;
  text: string;
  start_ms: number;
  end_ms: number;
};

export function useRecording() {
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
  const startTimeRef = useRef<number>(0);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // Synchronous refs for tokens — avoid race between setState and stopRecording()
  const finalTokensRef = useRef<Token[]>([]);
  const nonFinalTokensRef = useRef<Token[]>([]);
  // Signals Soniox has flushed all final tokens after stop()
  const finishCallbackRef = useRef<(() => void) | null>(null);

  const startRecording = useCallback(async () => {
    setState("starting");
    setError(null);
    setFinalTokens([]);
    setNonFinalTokens([]);
    setElapsed(0);
    setAudioBlob(null);
    setSystemAudioActive(false);
    audioChunksRef.current = [];
    finalTokensRef.current = [];
    nonFinalTokensRef.current = [];
    finishCallbackRef.current = null;

    try {
      // Get microphone stream
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = micStream;

      // Try to capture system audio (other participants in remote meetings)
      let systemStream: MediaStream | null = null;
      try {
        systemStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true, // required by spec; video track is discarded immediately
        });
        systemStream.getVideoTracks().forEach((t) => t.stop());
        if (systemStream.getAudioTracks().length === 0) {
          systemStream = null;
        }
      } catch {
        // User cancelled or browser doesn't support — mic-only fallback
      }
      systemStreamRef.current = systemStream;

      // Mix mic + system audio when both are available
      let combinedStream: MediaStream;
      if (systemStream) {
        const ctx = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(micStream).connect(dest);
        ctx.createMediaStreamSource(systemStream).connect(dest);
        combinedStream = dest.stream;
        audioContextRef.current = ctx;
        setSystemAudioActive(true);
        // Update UI if user stops screen sharing mid-recording
        systemStream.getAudioTracks().forEach((track) => {
          track.onended = () => setSystemAudioActive(false);
        });
      } else {
        combinedStream = micStream;
        setSystemAudioActive(false);
      }

      // Local MediaRecorder for saving the audio file
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

      // Create a separate stream clone for Soniox
      const sonioxStream = combinedStream.clone();

      const client = new SonioxClient({
        apiKey: async () => {
          const res = await fetch("/api/soniox-temp-key", { method: "POST" });
          const data = await res.json();
          if (!data.api_key) throw new Error(data.error || "Failed to get temp key");
          return data.api_key;
        },
        onStarted: () => {
          setState("recording");
          startTimeRef.current = Date.now();
          timerRef.current = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
          }, 500);
        },
        onPartialResult: (result) => {
          const tokens = result.tokens ?? [];
          const newFinal = tokens.filter((t) => t.is_final);
          const newNonFinal = tokens.filter((t) => !t.is_final);

          // Update refs synchronously so stopRecording() reads the latest values
          if (newFinal.length > 0) {
            finalTokensRef.current = [...finalTokensRef.current, ...newFinal];
          }
          nonFinalTokensRef.current = newNonFinal;

          // Update state for UI rendering
          if (newFinal.length > 0) {
            setFinalTokens((prev) => [...prev, ...newFinal]);
          }
          setNonFinalTokens(newNonFinal);
        },
        onFinished: () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Finalize local audio recording
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
          // Signal stopRecording() that Soniox is fully done flushing
          finishCallbackRef.current?.();
        },
        onError: (_status, message) => {
          setError(message);
          setState("error");
          // Unblock stopRecording() if it was waiting
          finishCallbackRef.current?.();
        },
      });

      clientRef.current = client;

      await client.start({
        model: "stt-rt-preview",
        languageHints: ["ar", "en"],
        enableSpeakerDiarization: true,
        enableEndpointDetection: true,
        stream: sonioxStream,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setState("error");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      systemStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    }
  }, []);

  const stopRecording = useCallback((): Promise<{
    transcript: string;
    segments: SpeakerSegment[];
    duration: number;
    audioBlob: Blob | null;
  }> => {
    return new Promise((resolve) => {
      setState("stopping");
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const finalDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);

      const finish = () => {
        // Include any remaining non-final tokens so partial speech at the end
        // isn't lost if Soniox didn't finalize them before stopping.
        const finalOnly = finalTokensRef.current;
        const leftoverNonFinal = nonFinalTokensRef.current;
        const allTokens = [...finalOnly, ...leftoverNonFinal];
        const transcript = allTokens.map((t) => t.text.replace(/<end>/gi, "")).join("");
        const segments = buildSegments(allTokens);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        systemStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioContextRef.current?.close().catch(() => {});
        setSystemAudioActive(false);

        const finalizeAudio = () => {
          const blob = audioChunksRef.current.length
            ? new Blob(audioChunksRef.current, { type: "audio/webm" })
            : null;
          resolve({ transcript, segments, duration: finalDuration, audioBlob: blob });
        };

        // Wait for MediaRecorder to actually finish writing the last chunks.
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
          // Safety fallback in case onstop never fires
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
          // Tiny buffer so the last onPartialResult ref update is definitely applied
          setTimeout(finish, 150);
        };
        finishCallbackRef.current = onDone;
        clientRef.current.stop();
        // Fallback: if onFinished never fires (slow network / lost WS), resolve anyway
        setTimeout(() => {
          if (!finished) onDone();
        }, 15000);
      } else {
        finish();
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clientRef.current?.cancel();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      systemStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close();
    };
  }, []);

  // beforeunload warning during recording
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
